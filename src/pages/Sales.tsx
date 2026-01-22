import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/Layout';
import { Sale } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Search, Edit2, Trash2, Eye, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuditLog } from '@/hooks/useAuditLog';

interface Product {
  id: string;
  name: string;
  selling_price: number;
  current_stock: number;
}

export default function Sales() {
  const { user } = useAuth();
  const { logAudit } = useAuditLog();
  const isAdmin = user?.role === 'admin';
  
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'add' | 'view'>('add');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  // New sale form state
  const [newSale, setNewSale] = useState({
    productId: '',
    quantity: 1,
  });

  useEffect(() => {
    fetchSales();
    fetchProducts();
  }, []);

  const fetchSales = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('sales')
        .select(`
          *,
          products (name, selling_price)
        `)
        .is('deleted_at', null) // Only get non-deleted sales
        .order('sale_date', { ascending: false });

      if (error) throw error;

      const mappedSales: Sale[] = (data || []).map(s => ({
        id: s.id,
        productId: s.product_id,
        productName: s.products?.name || 'Unknown Product',
        quantity: s.quantity,
        unitPrice: Number(s.unit_price),
        total: Number(s.total),
        saleDate: s.sale_date,
        recordedBy: s.recorded_by || '',
      }));

      setSales(mappedSales);
    } catch (error: any) {
      console.error('Error fetching sales:', error);
      toast.error('Failed to load sales');
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, selling_price, current_stock')
        .is('deleted_at', null) // Only get non-deleted products
        .gt('current_stock', 0)
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error: any) {
      console.error('Error fetching products:', error);
    }
  };

  const filteredSales = sales.filter(s => 
    s.productName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleAddSale = () => {
    setDialogMode('add');
    setNewSale({ productId: '', quantity: 1 });
    setIsDialogOpen(true);
  };

  const handleViewSale = (sale: Sale) => {
    setSelectedSale(sale);
    setDialogMode('view');
    setIsDialogOpen(true);
  };

  const handleSubmitSale = async () => {
    const product = products.find(p => p.id === newSale.productId);
    if (!product) {
      toast.error('Please select a product');
      return;
    }

    if (newSale.quantity <= 0) {
      toast.error('Quantity must be greater than 0');
      return;
    }

    setSaving(true);
    try {
      const total = product.selling_price * newSale.quantity;

      const { data, error } = await supabase
        .from('sales')
        .insert({
          product_id: newSale.productId,
          quantity: newSale.quantity,
          unit_price: product.selling_price,
          total: total,
          recorded_by: user?.id || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Log audit event
      await logAudit({
        actionType: 'create',
        entityType: 'sale',
        entityId: data?.id,
        entityName: product.name,
        details: { quantity: newSale.quantity, total }
      });

      setIsDialogOpen(false);
      toast.success('Sale recorded successfully');
      fetchSales();
      fetchProducts(); // Refresh stock
    } catch (error: any) {
      console.error('Error recording sale:', error);
      toast.error('Failed to record sale');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSale = async (sale: Sale) => {
    if (confirm('Are you sure you want to delete this transaction? It will be moved to the recycle bin.')) {
      try {
        // Soft delete - set deleted_at timestamp
        const { error } = await supabase
          .from('sales')
          .update({ 
            deleted_at: new Date().toISOString(),
            deleted_by: user?.id || null
          })
          .eq('id', sale.id);

        if (error) throw error;

        // Log audit event
        await logAudit({
          actionType: 'delete',
          entityType: 'sale',
          entityId: sale.id,
          entityName: sale.productName,
          details: { quantity: sale.quantity, total: sale.total, moved_to: 'recycle_bin' }
        });

        setSales(sales.filter(s => s.id !== sale.id));
        toast.success('Transaction moved to recycle bin');
      } catch (error: any) {
        console.error('Error deleting sale:', error);
        toast.error('Failed to delete transaction');
      }
    }
  };

  const totalSales = filteredSales.reduce((acc, s) => acc + s.total, 0);

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
            <h1 className="text-2xl font-bold text-heading">Sales Transactions</h1>
            <p className="text-muted-foreground mt-1">
              {isAdmin ? 'Manage all sales transactions' : 'Record and view your sales'}
            </p>
          </div>
          <Button onClick={handleAddSale} className="gap-2">
            <Plus size={18} />
            Add New Sale
          </Button>
        </div>

        {/* Summary Card */}
        <div className="card-stock-sage animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Transactions</p>
              <p className="text-2xl font-bold text-heading mt-1">{filteredSales.length}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Sales Value</p>
              <p className="text-2xl font-bold text-primary mt-1">{formatCurrency(totalSales)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Average Transaction</p>
              <p className="text-2xl font-bold text-heading mt-1">
                {formatCurrency(filteredSales.length > 0 ? totalSales / filteredSales.length : 0)}
              </p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="card-stock-sage">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Sales Table */}
        <div className="card-stock-sage p-0 overflow-hidden animate-fade-in">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Product</th>
                  <th>Quantity</th>
                  <th>Unit Price</th>
                  <th>Total</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-muted-foreground">
                      No sales found
                    </td>
                  </tr>
                ) : (
                  filteredSales.map((sale) => (
                    <tr key={sale.id}>
                      <td>{new Date(sale.saleDate).toLocaleDateString()}</td>
                      <td className="font-medium">{sale.productName}</td>
                      <td>{sale.quantity}</td>
                      <td>{formatCurrency(sale.unitPrice)}</td>
                      <td className="font-semibold">{formatCurrency(sale.total)}</td>
                      <td>
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={() => handleViewSale(sale)}
                          >
                            <Eye size={16} />
                          </Button>
                          {isAdmin && (
                            <>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Edit2 size={16} />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-danger hover:text-danger"
                                onClick={() => handleDeleteSale(sale)}
                              >
                                <Trash2 size={16} />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add Sale Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {dialogMode === 'add' ? 'Record New Sale' : 'Transaction Details'}
              </DialogTitle>
            </DialogHeader>

            {dialogMode === 'add' ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Product</Label>
                  <Select 
                    value={newSale.productId} 
                    onValueChange={(value) => setNewSale({ ...newSale, productId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map(product => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} - {formatCurrency(product.selling_price)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    min={1}
                    value={newSale.quantity}
                    onChange={(e) => setNewSale({ ...newSale, quantity: parseInt(e.target.value) || 1 })}
                  />
                </div>

                {newSale.productId && (
                  <div className="p-4 rounded-md bg-muted border border-border">
                    <p className="text-sm text-muted-foreground">Estimated Total</p>
                    <p className="text-xl font-bold text-primary">
                      {formatCurrency(
                        (products.find(p => p.id === newSale.productId)?.selling_price || 0) * newSale.quantity
                      )}
                    </p>
                  </div>
                )}
              </div>
            ) : selectedSale && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Transaction ID</Label>
                  <p className="font-mono mt-1 text-xs">#{selectedSale.id.slice(0, 8)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Date</Label>
                  <p className="mt-1">{new Date(selectedSale.saleDate).toLocaleDateString()}</p>
                </div>
                <div className="col-span-2">
                  <Label className="text-muted-foreground">Product</Label>
                  <p className="font-medium mt-1">{selectedSale.productName}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Quantity</Label>
                  <p className="mt-1">{selectedSale.quantity}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Unit Price</Label>
                  <p className="mt-1">{formatCurrency(selectedSale.unitPrice)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Total</Label>
                  <p className="font-semibold text-primary mt-1">{formatCurrency(selectedSale.total)}</p>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                {dialogMode === 'view' ? 'Close' : 'Cancel'}
              </Button>
              {dialogMode === 'add' && (
                <Button onClick={handleSubmitSale} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Record Sale
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
