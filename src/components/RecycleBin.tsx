import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuditLog } from '@/hooks/useAuditLog';
import { 
  Trash2, RotateCcw, Package, ShoppingCart, Loader2, 
  AlertTriangle, Clock, User
} from 'lucide-react';
import { format } from 'date-fns';

interface DeletedProduct {
  id: string;
  name: string;
  sku: string;
  category: string;
  selling_price: number;
  deleted_at: string;
  deleted_by: string | null;
}

interface DeletedSale {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total: number;
  sale_date: string;
  deleted_at: string;
  deleted_by: string | null;
  product_name?: string;
}

export function RecycleBin() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { logAudit } = useAuditLog();
  
  const [deletedProducts, setDeletedProducts] = useState<DeletedProduct[]>([]);
  const [deletedSales, setDeletedSales] = useState<DeletedSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchDeletedItems();
  }, []);

  const fetchDeletedItems = async () => {
    setLoading(true);
    try {
      // Fetch deleted products
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, name, sku, category, selling_price, deleted_at, deleted_by')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });

      if (productsError) throw productsError;
      setDeletedProducts(products || []);

      // Fetch deleted sales with product names
      const { data: sales, error: salesError } = await supabase
        .from('sales')
        .select(`
          id, product_id, quantity, unit_price, total, sale_date, deleted_at, deleted_by,
          products(name)
        `)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });

      if (salesError) throw salesError;
      
      const mappedSales = (sales || []).map((s: any) => ({
        ...s,
        product_name: s.products?.name || 'Unknown Product',
      }));
      setDeletedSales(mappedSales);

    } catch (error: any) {
      console.error('Error fetching deleted items:', error);
      toast.error('Failed to load recycle bin');
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreProduct = async (product: DeletedProduct) => {
    setActionLoading(product.id);
    try {
      const { error } = await supabase
        .from('products')
        .update({ deleted_at: null, deleted_by: null })
        .eq('id', product.id);

      if (error) throw error;

      await logAudit({
        actionType: 'restore',
        entityType: 'product',
        entityId: product.id,
        entityName: product.name,
        details: { restored_from: 'recycle_bin' },
      });

      toast.success(`"${product.name}" restored successfully`);
      fetchDeletedItems();
    } catch (error: any) {
      console.error('Error restoring product:', error);
      toast.error('Failed to restore product');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePermanentDeleteProduct = async (product: DeletedProduct) => {
    if (!isAdmin) {
      toast.error('Only admins can permanently delete items');
      return;
    }

    setActionLoading(product.id);
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', product.id);

      if (error) throw error;

      await logAudit({
        actionType: 'permanent_delete',
        entityType: 'product',
        entityId: product.id,
        entityName: product.name,
        details: { deleted_permanently: true },
      });

      toast.success(`"${product.name}" permanently deleted`);
      fetchDeletedItems();
    } catch (error: any) {
      console.error('Error deleting product:', error);
      toast.error('Failed to permanently delete product');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestoreSale = async (sale: DeletedSale) => {
    setActionLoading(sale.id);
    try {
      const { error } = await supabase
        .from('sales')
        .update({ deleted_at: null, deleted_by: null })
        .eq('id', sale.id);

      if (error) throw error;

      await logAudit({
        actionType: 'restore',
        entityType: 'sale',
        entityId: sale.id,
        entityName: sale.product_name || 'Sale',
        details: { restored_from: 'recycle_bin', quantity: sale.quantity, total: sale.total },
      });

      toast.success('Sale restored successfully');
      fetchDeletedItems();
    } catch (error: any) {
      console.error('Error restoring sale:', error);
      toast.error('Failed to restore sale');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePermanentDeleteSale = async (sale: DeletedSale) => {
    if (!isAdmin) {
      toast.error('Only admins can permanently delete items');
      return;
    }

    setActionLoading(sale.id);
    try {
      const { error } = await supabase
        .from('sales')
        .delete()
        .eq('id', sale.id);

      if (error) throw error;

      await logAudit({
        actionType: 'permanent_delete',
        entityType: 'sale',
        entityId: sale.id,
        entityName: sale.product_name || 'Sale',
        details: { deleted_permanently: true, quantity: sale.quantity, total: sale.total },
      });

      toast.success('Sale permanently deleted');
      fetchDeletedItems();
    } catch (error: any) {
      console.error('Error deleting sale:', error);
      toast.error('Failed to permanently delete sale');
    } finally {
      setActionLoading(null);
    }
  };

  const handleEmptyTrash = async (type: 'products' | 'sales') => {
    if (!isAdmin) {
      toast.error('Only admins can empty the trash');
      return;
    }

    setActionLoading('empty-' + type);
    try {
      const items = type === 'products' ? deletedProducts : deletedSales;
      
      for (const item of items) {
        const { error } = await supabase
          .from(type)
          .delete()
          .eq('id', item.id);
        
        if (error) throw error;
      }

      await logAudit({
        actionType: 'empty_trash',
        entityType: type,
        entityId: undefined,
        entityName: `All deleted ${type}`,
        details: { count: items.length },
      });

      toast.success(`${items.length} ${type} permanently deleted`);
      fetchDeletedItems();
    } catch (error: any) {
      console.error('Error emptying trash:', error);
      toast.error('Failed to empty trash');
    } finally {
      setActionLoading(null);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(value);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalItems = deletedProducts.length + deletedSales.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Recycle Bin
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {totalItems} item{totalItems !== 1 ? 's' : ''} in trash
          </p>
        </div>
      </div>

      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products" className="gap-2">
            <Package className="h-4 w-4" />
            Products ({deletedProducts.length})
          </TabsTrigger>
          <TabsTrigger value="sales" className="gap-2">
            <ShoppingCart className="h-4 w-4" />
            Sales ({deletedSales.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Deleted Products</CardTitle>
                {isAdmin && deletedProducts.length > 0 && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" className="gap-2">
                        <Trash2 className="h-4 w-4" />
                        Empty Trash
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-destructive" />
                          Empty Products Trash?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete {deletedProducts.length} product{deletedProducts.length !== 1 ? 's' : ''}. 
                          This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleEmptyTrash('products')}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {actionLoading === 'empty-products' ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            'Delete All'
                          )}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {deletedProducts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No deleted products</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Deleted</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deletedProducts.map(product => (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{product.name}</p>
                            <p className="text-xs text-muted-foreground">{product.sku}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{product.category}</Badge>
                        </TableCell>
                        <TableCell>{formatCurrency(product.selling_price)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {format(new Date(product.deleted_at), 'MMM d, yyyy')}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRestoreProduct(product)}
                              disabled={actionLoading === product.id}
                              className="gap-1"
                            >
                              {actionLoading === product.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <RotateCcw className="h-3 w-3" />
                              )}
                              Restore
                            </Button>
                            {isAdmin && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    disabled={actionLoading === product.id}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Permanently Delete?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently delete "{product.name}". This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handlePermanentDeleteProduct(product)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Delete Forever
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sales" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Deleted Sales</CardTitle>
                {isAdmin && deletedSales.length > 0 && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" className="gap-2">
                        <Trash2 className="h-4 w-4" />
                        Empty Trash
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-destructive" />
                          Empty Sales Trash?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete {deletedSales.length} sale{deletedSales.length !== 1 ? 's' : ''}. 
                          This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleEmptyTrash('sales')}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {actionLoading === 'empty-sales' ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            'Delete All'
                          )}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {deletedSales.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No deleted sales</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Sale Date</TableHead>
                      <TableHead>Deleted</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deletedSales.map(sale => (
                      <TableRow key={sale.id}>
                        <TableCell className="font-medium">{sale.product_name}</TableCell>
                        <TableCell>{sale.quantity}</TableCell>
                        <TableCell>{formatCurrency(sale.total)}</TableCell>
                        <TableCell>
                          {format(new Date(sale.sale_date), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {format(new Date(sale.deleted_at), 'MMM d, yyyy')}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRestoreSale(sale)}
                              disabled={actionLoading === sale.id}
                              className="gap-1"
                            >
                              {actionLoading === sale.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <RotateCcw className="h-3 w-3" />
                              )}
                              Restore
                            </Button>
                            {isAdmin && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    disabled={actionLoading === sale.id}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Permanently Delete?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently delete this sale record. This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handlePermanentDeleteSale(sale)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Delete Forever
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {!isAdmin && totalItems > 0 && (
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-muted-foreground">
              <AlertTriangle className="h-5 w-5" />
              <p className="text-sm">
                Only administrators can permanently delete items. Contact an admin to empty the recycle bin.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
