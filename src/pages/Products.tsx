import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/Layout';
import { ProductsTable } from '@/components/ProductsTable';
import { Product } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Upload, Search, Filter, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export default function Products() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'view' | 'edit' | 'add'>('view');
  
  // Predefined categories
  const predefinedCategories = ['Electronics', 'Beverages', 'Food', 'Clothing', 'Office Supplies', 'Hardware', 'General'];

  // Form state for add/edit
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    description: '',
    category: 'General',
    currentStock: 0,
    minStock: 0,
    costPrice: 0,
    sellingPrice: 0,
  });

  const categories = [...new Set(products.map(p => p.category))];

  // Fetch products from Supabase
  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name');

      if (error) throw error;

      const mappedProducts: Product[] = (data || []).map(p => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        description: p.description || '',
        category: p.category,
        currentStock: p.current_stock,
        minStock: p.min_stock,
        reorderPoint: p.min_stock,
        costPrice: Number(p.cost_price),
        sellingPrice: Number(p.selling_price),
        leadTimeDays: 0,
        supplierId: p.supplier_id || '',
        status: p.current_stock <= 0 ? 'out_of_stock' : 
                p.current_stock <= p.min_stock ? 'low_stock' : 'in_stock',
        createdAt: p.created_at,
        createdBy: p.created_by || '',
      }));

      setProducts(mappedProducts);
    } catch (error: any) {
      console.error('Error fetching products:', error);
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || product.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const handleView = (product: Product) => {
    setSelectedProduct(product);
    setDialogMode('view');
    setIsDialogOpen(true);
  };

  const handleEdit = (product: Product) => {
    setSelectedProduct(product);
    setFormData({
      sku: product.sku,
      name: product.name,
      description: product.description || '',
      category: product.category,
      currentStock: product.currentStock,
      minStock: product.minStock,
      costPrice: product.costPrice,
      sellingPrice: product.sellingPrice,
    });
    setDialogMode('edit');
    setIsDialogOpen(true);
  };

  const handleDelete = async (product: Product) => {
    if (confirm(`Are you sure you want to delete "${product.name}"?`)) {
      try {
        const { error } = await supabase
          .from('products')
          .delete()
          .eq('id', product.id);

        if (error) throw error;

        setProducts(products.filter(p => p.id !== product.id));
        toast.success('Product deleted successfully');
      } catch (error: any) {
        console.error('Error deleting product:', error);
        toast.error('Failed to delete product');
      }
    }
  };

  const handleForecast = (product: Product) => {
    toast.info(`Running AI forecast for ${product.name}...`);
  };

  const handleAddNew = () => {
    setSelectedProduct(null);
    setFormData({
      sku: '',
      name: '',
      description: '',
      category: 'General',
      currentStock: 0,
      minStock: 10,
      costPrice: 0,
      sellingPrice: 0,
    });
    setDialogMode('add');
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.sku || !formData.name || !formData.category) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      if (dialogMode === 'add') {
        const { data, error } = await supabase
          .from('products')
          .insert({
            sku: formData.sku,
            name: formData.name,
            description: formData.description,
            category: formData.category,
            current_stock: formData.currentStock,
            min_stock: formData.minStock,
            cost_price: formData.costPrice,
            selling_price: formData.sellingPrice,
          })
          .select()
          .single();

        if (error) throw error;

        toast.success('Product added successfully');
      } else if (dialogMode === 'edit' && selectedProduct) {
        const { error } = await supabase
          .from('products')
          .update({
            sku: formData.sku,
            name: formData.name,
            description: formData.description,
            category: formData.category,
            current_stock: formData.currentStock,
            min_stock: formData.minStock,
            cost_price: formData.costPrice,
            selling_price: formData.sellingPrice,
          })
          .eq('id', selectedProduct.id);

        if (error) throw error;

        toast.success('Product updated successfully');
      }

      setIsDialogOpen(false);
      fetchProducts(); // Refresh the list
    } catch (error: any) {
      console.error('Error saving product:', error);
      toast.error(error.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-heading">Products</h1>
          <p className="text-muted-foreground mt-1">
              Manage your product inventory
            </p>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <Button variant="outline" className="gap-2">
                <Upload size={18} />
                Import CSV
              </Button>
            )}
            <Button onClick={handleAddNew} className="gap-2">
              <Plus size={18} />
              Add Product
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="card-stock-sage">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-40">
                  <Filter size={16} className="mr-2" />
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="in_stock">In Stock</SelectItem>
                  <SelectItem value="low_stock">Low Stock</SelectItem>
                  <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Products Table */}
        <div className="card-stock-sage p-0 overflow-hidden">
          <ProductsTable
            products={filteredProducts}
            isEditable={true}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onForecast={handleForecast}
          />
        </div>

        <p className="text-sm text-muted-foreground text-center">
          Showing {filteredProducts.length} of {products.length} products
        </p>

        {/* Product Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {dialogMode === 'add' ? 'Add New Product' : 
                 dialogMode === 'edit' ? 'Edit Product' : 'Product Details'}
              </DialogTitle>
            </DialogHeader>

            {selectedProduct && dialogMode === 'view' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">SKU</Label>
                  <p className="font-mono mt-1">{selectedProduct.sku}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Category</Label>
                  <p className="mt-1">{selectedProduct.category}</p>
                </div>
                <div className="col-span-2">
                  <Label className="text-muted-foreground">Product Name</Label>
                  <p className="font-medium mt-1">{selectedProduct.name}</p>
                </div>
                <div className="col-span-2">
                  <Label className="text-muted-foreground">Description</Label>
                  <p className="mt-1 text-sm">{selectedProduct.description}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Current Stock</Label>
                  <p className="mt-1 font-semibold">{selectedProduct.currentStock}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Minimum Stock</Label>
                  <p className="mt-1">{selectedProduct.minStock}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Cost Price</Label>
                  <p className="mt-1">{formatCurrency(selectedProduct.costPrice)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Selling Price</Label>
                  <p className="mt-1 font-semibold">{formatCurrency(selectedProduct.sellingPrice)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <p className="mt-1">
                    <span className={`status-badge ${
                      selectedProduct.status === 'in_stock' ? 'status-success' :
                      selectedProduct.status === 'low_stock' ? 'status-warning' : 'status-danger'
                    }`}>
                      {selectedProduct.status === 'in_stock' ? 'In Stock' :
                       selectedProduct.status === 'low_stock' ? 'Low Stock' : 'Out of Stock'}
                    </span>
                  </p>
                </div>
              </div>
            )}

            {(dialogMode === 'edit' || dialogMode === 'add') && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="sku">SKU *</Label>
                  <Input 
                    id="sku" 
                    value={formData.sku}
                    onChange={(e) => setFormData({...formData, sku: e.target.value})}
                    className="mt-1" 
                  />
                </div>
                <div>
                  <Label htmlFor="category">Category *</Label>
                  <Select value={formData.category} onValueChange={(val) => setFormData({...formData, category: val})}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {predefinedCategories.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label htmlFor="name">Product Name *</Label>
                  <Input 
                    id="name" 
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="mt-1" 
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Input 
                    id="description" 
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="mt-1" 
                  />
                </div>
                <div>
                  <Label htmlFor="currentStock">Current Stock</Label>
                  <Input 
                    id="currentStock" 
                    type="number" 
                    value={formData.currentStock}
                    onChange={(e) => setFormData({...formData, currentStock: parseInt(e.target.value) || 0})}
                    className="mt-1" 
                  />
                </div>
                <div>
                  <Label htmlFor="minStock">Minimum Stock</Label>
                  <Input 
                    id="minStock" 
                    type="number" 
                    value={formData.minStock}
                    onChange={(e) => setFormData({...formData, minStock: parseInt(e.target.value) || 0})}
                    className="mt-1" 
                  />
                </div>
                <div>
                  <Label htmlFor="costPrice">Cost Price (₱)</Label>
                  <Input 
                    id="costPrice" 
                    type="number" 
                    value={formData.costPrice}
                    onChange={(e) => setFormData({...formData, costPrice: parseFloat(e.target.value) || 0})}
                    className="mt-1" 
                  />
                </div>
                <div>
                  <Label htmlFor="sellingPrice">Selling Price (₱)</Label>
                  <Input 
                    id="sellingPrice" 
                    type="number" 
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData({...formData, sellingPrice: parseFloat(e.target.value) || 0})}
                    className="mt-1" 
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                {dialogMode === 'view' ? 'Close' : 'Cancel'}
              </Button>
              {(dialogMode === 'edit' || dialogMode === 'add') && (
                <Button onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {dialogMode === 'add' ? 'Add Product' : 'Save Changes'}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
