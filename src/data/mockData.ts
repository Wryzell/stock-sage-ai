import { Product, Sale, Forecast, Alert, User, Supplier } from '@/types';

export const mockUsers: User[] = [
  {
    id: '1',
    email: 'admin@demo.com',
    fullName: 'System Administrator',
    role: 'super_admin',
    status: 'active',
    createdAt: '2024-01-01',
    lastLogin: '2024-12-29T08:30:00',
  },
  {
    id: '2',
    email: 'staff@demo.com',
    fullName: 'John Doe',
    role: 'staff',
    status: 'active',
    createdAt: '2024-03-15',
    lastLogin: '2024-12-29T09:15:00',
  },
  {
    id: '3',
    email: 'staff2@store.com',
    fullName: 'Jane Smith',
    role: 'staff',
    status: 'active',
    createdAt: '2024-06-20',
    lastLogin: '2024-12-28T16:45:00',
  },
];

export const mockSuppliers: Supplier[] = [
  { id: '1', name: 'TechDistributors Inc.', contactEmail: 'sales@techdist.com', phone: '+63 917 123 4567', address: 'Makati City, Philippines', leadTimeDays: 7 },
  { id: '2', name: 'Global Electronics', contactEmail: 'orders@globalelec.com', phone: '+63 918 234 5678', address: 'Quezon City, Philippines', leadTimeDays: 5 },
  { id: '3', name: 'Premium Peripherals', contactEmail: 'supply@premiumph.com', phone: '+63 919 345 6789', address: 'Cebu City, Philippines', leadTimeDays: 10 },
];

export const mockProducts: Product[] = [
  { id: '1', name: 'Dell XPS 13 Laptop', sku: 'DELL-XPS13-001', category: 'Laptops', description: '13.4" FHD+ Display, Intel Core i7, 16GB RAM, 512GB SSD', currentStock: 12, minStock: 5, reorderPoint: 8, costPrice: 55000, sellingPrice: 72000, supplierId: '1', leadTimeDays: 7, status: 'in_stock', createdAt: '2024-01-15', createdBy: '1' },
  { id: '2', name: 'Logitech MX Master 3S', sku: 'LOG-MXM3S-001', category: 'Accessories', description: 'Wireless Performance Mouse, 8000 DPI', currentStock: 45, minStock: 15, reorderPoint: 20, costPrice: 4500, sellingPrice: 5999, supplierId: '2', leadTimeDays: 5, status: 'in_stock', createdAt: '2024-02-10', createdBy: '1' },
  { id: '3', name: 'Logitech C920 HD Pro Webcam', sku: 'LOG-C920-001', category: 'Peripherals', description: '1080p Full HD Webcam with Stereo Audio', currentStock: 8, minStock: 10, reorderPoint: 12, costPrice: 3200, sellingPrice: 4299, supplierId: '2', leadTimeDays: 5, status: 'low_stock', createdAt: '2024-02-15', createdBy: '1' },
  { id: '4', name: 'Razer BlackWidow V4', sku: 'RAZ-BWV4-001', category: 'Accessories', description: 'Mechanical Gaming Keyboard, RGB Lighting', currentStock: 15, minStock: 8, reorderPoint: 10, costPrice: 8500, sellingPrice: 11999, supplierId: '3', leadTimeDays: 10, status: 'in_stock', createdAt: '2024-03-01', createdBy: '1' },
  { id: '5', name: 'ASUS ProArt 24" Monitor', sku: 'ASUS-PA24-001', category: 'Monitors', description: '24" IPS 4K UHD Professional Monitor', currentStock: 10, minStock: 4, reorderPoint: 6, costPrice: 22000, sellingPrice: 28999, supplierId: '1', leadTimeDays: 7, status: 'in_stock', createdAt: '2024-03-10', createdBy: '1' },
  { id: '6', name: 'Samsung 970 EVO Plus 1TB', sku: 'SAM-970EVO-1TB', category: 'Storage', description: 'NVMe M.2 SSD, 3500MB/s Read', currentStock: 32, minStock: 15, reorderPoint: 20, costPrice: 5500, sellingPrice: 7499, supplierId: '2', leadTimeDays: 5, status: 'in_stock', createdAt: '2024-03-20', createdBy: '1' },
  { id: '7', name: 'Apple AirPods Pro 2', sku: 'APL-APP2-001', category: 'Audio', description: 'Active Noise Cancellation, Spatial Audio', currentStock: 3, minStock: 8, reorderPoint: 10, costPrice: 12000, sellingPrice: 14999, supplierId: '1', leadTimeDays: 7, status: 'low_stock', createdAt: '2024-04-05', createdBy: '1' },
  { id: '8', name: 'HP LaserJet Pro MFP', sku: 'HP-LJPRO-001', category: 'Printers', description: 'All-in-One Wireless Laser Printer', currentStock: 6, minStock: 3, reorderPoint: 4, costPrice: 18000, sellingPrice: 23999, supplierId: '1', leadTimeDays: 7, status: 'in_stock', createdAt: '2024-04-15', createdBy: '1' },
  { id: '9', name: 'Corsair Vengeance 32GB RAM', sku: 'COR-VEN32-001', category: 'Components', description: 'DDR5 5600MHz, 2x16GB Kit', currentStock: 18, minStock: 10, reorderPoint: 12, costPrice: 7500, sellingPrice: 9999, supplierId: '2', leadTimeDays: 5, status: 'in_stock', createdAt: '2024-05-01', createdBy: '1' },
  { id: '10', name: 'NVIDIA RTX 4070 Super', sku: 'NV-RTX4070S-001', category: 'Graphics Cards', description: '12GB GDDR6X, Ray Tracing', currentStock: 4, minStock: 3, reorderPoint: 5, costPrice: 35000, sellingPrice: 42999, supplierId: '1', leadTimeDays: 7, status: 'in_stock', createdAt: '2024-05-15', createdBy: '1' },
  { id: '11', name: 'Anker PowerCore 26800mAh', sku: 'ANK-PC26800-001', category: 'Accessories', description: 'Portable Charger, 3-Port USB', currentStock: 28, minStock: 15, reorderPoint: 18, costPrice: 2200, sellingPrice: 2999, supplierId: '3', leadTimeDays: 10, status: 'in_stock', createdAt: '2024-06-01', createdBy: '1' },
  { id: '12', name: 'Blue Yeti X Microphone', sku: 'BLU-YETIX-001', category: 'Audio', description: 'USB Condenser Microphone, 4 Patterns', currentStock: 0, minStock: 5, reorderPoint: 7, costPrice: 7000, sellingPrice: 8999, supplierId: '2', leadTimeDays: 5, status: 'out_of_stock', createdAt: '2024-06-15', createdBy: '1' },
  { id: '13', name: 'Lenovo ThinkPad X1 Carbon', sku: 'LEN-X1C-001', category: 'Laptops', description: '14" 2.8K OLED, Intel Core i7, 32GB RAM', currentStock: 7, minStock: 3, reorderPoint: 5, costPrice: 85000, sellingPrice: 99999, supplierId: '1', leadTimeDays: 7, status: 'in_stock', createdAt: '2024-07-01', createdBy: '1' },
  { id: '14', name: 'TP-Link Archer AX6000', sku: 'TPL-AX6000-001', category: 'Networking', description: 'WiFi 6 Router, 6000 Mbps', currentStock: 11, minStock: 5, reorderPoint: 7, costPrice: 9500, sellingPrice: 12499, supplierId: '3', leadTimeDays: 10, status: 'in_stock', createdAt: '2024-07-15', createdBy: '1' },
  { id: '15', name: 'Elgato Stream Deck MK.2', sku: 'ELG-SD-MK2', category: 'Accessories', description: '15 LCD Keys, Customizable', currentStock: 9, minStock: 4, reorderPoint: 6, costPrice: 7500, sellingPrice: 9499, supplierId: '2', leadTimeDays: 5, status: 'in_stock', createdAt: '2024-08-01', createdBy: '1' },
];

export const mockSales: Sale[] = [
  { id: '1', productId: '1', productName: 'Dell XPS 13 Laptop', quantity: 2, unitPrice: 72000, total: 144000, saleDate: '2024-12-29', customerType: 'corporate', recordedBy: '2' },
  { id: '2', productId: '2', productName: 'Logitech MX Master 3S', quantity: 5, unitPrice: 5999, total: 29995, saleDate: '2024-12-29', customerType: 'retail', recordedBy: '3' },
  { id: '3', productId: '4', productName: 'Razer BlackWidow V4', quantity: 3, unitPrice: 11999, total: 35997, saleDate: '2024-12-28', customerType: 'retail', recordedBy: '2' },
  { id: '4', productId: '6', productName: 'Samsung 970 EVO Plus 1TB', quantity: 8, unitPrice: 7499, total: 59992, saleDate: '2024-12-28', customerType: 'wholesale', recordedBy: '3' },
  { id: '5', productId: '10', productName: 'NVIDIA RTX 4070 Super', quantity: 1, unitPrice: 42999, total: 42999, saleDate: '2024-12-27', customerType: 'retail', recordedBy: '2' },
];

export const mockForecasts: Forecast[] = [
  { id: '1', productId: '1', productName: 'Dell XPS 13 Laptop', forecastDate: '2025-01-15', predictedDemand: 18, confidenceLevel: 85, algorithmUsed: 'Exponential Smoothing', createdBy: '1' },
  { id: '2', productId: '3', productName: 'Logitech C920 HD Pro Webcam', forecastDate: '2025-01-15', predictedDemand: 25, confidenceLevel: 78, algorithmUsed: 'Moving Average', createdBy: '1' },
  { id: '3', productId: '7', productName: 'Apple AirPods Pro 2', forecastDate: '2025-01-15', predictedDemand: 15, confidenceLevel: 82, algorithmUsed: 'Linear Regression', createdBy: '1' },
  { id: '4', productId: '12', productName: 'Blue Yeti X Microphone', forecastDate: '2025-01-15', predictedDemand: 12, confidenceLevel: 75, algorithmUsed: 'Seasonal Detection', createdBy: '1' },
];

export const mockAlerts: Alert[] = [
  { id: '1', type: 'low_stock', productId: '3', productName: 'Logitech C920 HD Pro Webcam', message: 'Stock below minimum level (8/10)', severity: 'warning', createdAt: '2024-12-29T08:00:00' },
  { id: '2', type: 'low_stock', productId: '7', productName: 'Apple AirPods Pro 2', message: 'Stock critically low (3/8)', severity: 'critical', createdAt: '2024-12-29T08:00:00' },
  { id: '3', type: 'stockout_risk', productId: '12', productName: 'Blue Yeti X Microphone', message: 'Out of stock - immediate reorder required', severity: 'critical', createdAt: '2024-12-29T07:30:00' },
  { id: '4', type: 'demand_surge', productId: '1', productName: 'Dell XPS 13 Laptop', message: '+25% demand expected in January (Back to School)', severity: 'info', createdAt: '2024-12-28T15:00:00' },
  { id: '5', type: 'stockout_risk', productId: '3', productName: 'Logitech C920 HD Pro Webcam', message: 'Stockout risk in 5 days based on current sales velocity', severity: 'warning', createdAt: '2024-12-28T12:00:00' },
];

export const historicalSalesData = [
  { month: 'Jul', actual: 125000, predicted: 120000 },
  { month: 'Aug', actual: 145000, predicted: 140000 },
  { month: 'Sep', actual: 138000, predicted: 142000 },
  { month: 'Oct', actual: 165000, predicted: 155000 },
  { month: 'Nov', actual: 198000, predicted: 185000 },
  { month: 'Dec', actual: 220000, predicted: 210000 },
  { month: 'Jan (Forecast)', actual: null, predicted: 245000 },
];

export const categoryDistribution = [
  { category: 'Laptops', value: 35, count: 19 },
  { category: 'Accessories', value: 25, count: 88 },
  { category: 'Monitors', value: 15, count: 10 },
  { category: 'Audio', value: 10, count: 11 },
  { category: 'Storage', value: 10, count: 32 },
  { category: 'Other', value: 5, count: 27 },
];
