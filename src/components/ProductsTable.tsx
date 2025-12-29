import { Product } from '@/types';
import { Button } from '@/components/ui/button';
import { Edit2, Trash2, Eye, TrendingUp } from 'lucide-react';

interface ProductsTableProps {
  products: Product[];
  isEditable?: boolean;
  onEdit?: (product: Product) => void;
  onDelete?: (product: Product) => void;
  onView?: (product: Product) => void;
  onForecast?: (product: Product) => void;
}

export function ProductsTable({ 
  products, 
  isEditable = true, 
  onEdit, 
  onDelete,
  onView,
  onForecast 
}: ProductsTableProps) {
  const getStatusBadge = (status: Product['status']) => {
    const classes = {
      in_stock: 'status-badge status-success',
      low_stock: 'status-badge status-warning',
      out_of_stock: 'status-badge status-danger',
    };
    const labels = {
      in_stock: 'In Stock',
      low_stock: 'Low Stock',
      out_of_stock: 'Out of Stock',
    };
    return <span className={classes[status]}>{labels[status]}</span>;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>SKU</th>
            <th>Product Name</th>
            <th>Category</th>
            <th>Stock</th>
            <th>Min Stock</th>
            {isEditable && <th>Price</th>}
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id}>
              <td className="font-mono text-sm">{product.sku}</td>
              <td className="font-medium">{product.name}</td>
              <td>{product.category}</td>
              <td className={product.currentStock <= product.minStock ? 'text-danger font-semibold' : ''}>
                {product.currentStock}
              </td>
              <td>{product.minStock}</td>
              {isEditable && <td>{formatCurrency(product.sellingPrice)}</td>}
              <td>{getStatusBadge(product.status)}</td>
              <td>
                <div className="flex items-center gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={() => onView?.(product)}
                  >
                    <Eye size={16} />
                  </Button>
                  {isEditable && (
                    <>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => onEdit?.(product)}
                      >
                        <Edit2 size={16} />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => onForecast?.(product)}
                      >
                        <TrendingUp size={16} />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-danger hover:text-danger"
                        onClick={() => onDelete?.(product)}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
