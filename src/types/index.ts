export type UserRole = 'admin' | 'staff';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: 'active' | 'inactive';
  createdAt: string;
  lastLogin: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  description: string;
  currentStock: number;
  minStock: number;
  reorderPoint: number;
  costPrice: number;
  sellingPrice: number;
  supplierId: string;
  leadTimeDays: number;
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
  createdAt: string;
  createdBy: string;
}

export interface Sale {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  saleDate: string;
  recordedBy: string;
  approvedBy?: string;
}

export interface Forecast {
  id: string;
  productId: string;
  productName: string;
  forecastDate: string;
  predictedDemand: number;
  confidenceLevel: number;
  algorithmUsed: string;
  actualVsPredicted?: number;
  createdBy: string;
}

export interface Alert {
  id: string;
  type: 'low_stock' | 'stockout_risk' | 'demand_surge' | 'dead_stock';
  productId: string;
  productName: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactEmail: string;
  phone: string;
  address: string;
  leadTimeDays: number;
}
