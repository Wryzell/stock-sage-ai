import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/Layout';
import { ProductsTable } from '@/components/ProductsTable';
import { mockProducts } from '@/data/mockData';
import { Product } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Upload, Search, Filter } from 'lucide-react';
import { toast } from 'sonner';

export default function Products() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  
  const [products, setProducts] = useState<Product[]>(mockProducts);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'view' | 'edit' | 'add'>('view');

  const categories = [...new Set(products.map(p => p.category))];

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
    setDialogMode('edit');
    setIsDialogOpen(true);
  };

  const handleDelete = (product: Product) => {
    if (confirm(`Are you sure you want to delete "${product.name}"?`)) {
      setProducts(products.filter(p => p.id !== product.id));
      toast.success('Product deleted successfully');
    }
  };

  const handleForecast = (product: Product) => {
    toast.info(`Running AI forecast for ${product.name}...`);
  };

  const handleAddNew = () => {
    setSelectedProduct(null);
    setDialogMode('add');
    setIsDialogOpen(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-heading">Products</h1>
            <p className="text-muted-foreground mt-1">
              {isSuperAdmin ? 'Manage your product inventory' : 'View product inventory'}
            </p>
          </div>
          {isSuperAdmin && (
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2">
                <Upload size={18} />
                Import CSV
              </Button>
              <Button onClick={handleAddNew} className="gap-2">
                <Plus size={18} />
                Add Product
              </Button>
            </div>
          )}
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
            isEditable={isSuperAdmin}
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
                  <Label className="text-muted-foreground">Lead Time</Label>
                  <p className="mt-1">{selectedProduct.leadTimeDays} days</p>
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

            {(dialogMode === 'edit' || dialogMode === 'add') && isSuperAdmin && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="sku">SKU</Label>
                  <Input id="sku" defaultValue={selectedProduct?.sku || ''} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select defaultValue={selectedProduct?.category || ''}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label htmlFor="name">Product Name</Label>
                  <Input id="name" defaultValue={selectedProduct?.name || ''} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="currentStock">Current Stock</Label>
                  <Input id="currentStock" type="number" defaultValue={selectedProduct?.currentStock || 0} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="minStock">Minimum Stock</Label>
                  <Input id="minStock" type="number" defaultValue={selectedProduct?.minStock || 0} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="costPrice">Cost Price (₱)</Label>
                  <Input id="costPrice" type="number" defaultValue={selectedProduct?.costPrice || 0} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="sellingPrice">Selling Price (₱)</Label>
                  <Input id="sellingPrice" type="number" defaultValue={selectedProduct?.sellingPrice || 0} className="mt-1" />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                {dialogMode === 'view' ? 'Close' : 'Cancel'}
              </Button>
              {(dialogMode === 'edit' || dialogMode === 'add') && isSuperAdmin && (
                <Button onClick={() => {
                  toast.success(dialogMode === 'add' ? 'Product added successfully' : 'Product updated successfully');
                  setIsDialogOpen(false);
                }}>
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
