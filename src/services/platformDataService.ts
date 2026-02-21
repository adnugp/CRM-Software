import { getProjects, getTenders, getEmployees, getRegistrations, getPayments, getSubscriptions, getPartners } from './firestore';

// Mock data for customers, products, orders, invoices
const mockCustomers = [
  { id: '1', name: 'TechCorp', email: 'contact@techcorp.com', phone: '+1-555-0101', address: '123 Tech Street, Silicon Valley, CA 94000' },
  { id: '2', name: 'Innovation Labs', email: 'info@innovationlabs.com', phone: '+1-555-0102', address: '456 Innovation Drive, Austin, TX 78701' },
  { id: '3', name: 'Digital Solutions', email: 'hello@digitalsolutions.com', phone: '+1-555-0103', address: '789 Digital Avenue, Seattle, WA 98101' },
];

const mockProducts = [
  { id: '1', name: 'CRM Software', category: 'Software', price: 99.99, stock: 50, description: 'Complete customer relationship management solution' },
  { id: '2', name: 'AI Analytics', category: 'Analytics', price: 149.99, stock: 25, description: 'Advanced AI-powered business analytics' },
  { id: '3', name: 'Cloud Storage', category: 'Storage', price: 29.99, stock: 100, description: 'Secure cloud storage solution' },
];

const mockOrders = [
  { id: '1', customerId: '1', productId: '1', quantity: 2, total: 199.98, status: 'completed', date: '2024-01-15' },
  { id: '2', customerId: '2', productId: '2', quantity: 1, total: 149.99, status: 'processing', date: '2024-01-16' },
  { id: '3', customerId: '3', productId: '3', quantity: 5, total: 149.95, status: 'pending', date: '2024-01-17' },
];

const mockInvoices = [
  { id: '1', orderId: '1', amount: 199.98, dueDate: '2024-02-15', status: 'paid', date: '2024-01-15' },
  { id: '2', orderId: '2', amount: 149.99, dueDate: '2024-02-16', status: 'pending', date: '2024-01-16' },
  { id: '3', orderId: '3', amount: 149.95, dueDate: '2024-02-17', status: 'draft', date: '2024-01-17' },
];

class PlatformDataService {
  private subscribers: Array<() => void> = [];

  // Customer methods
  async getCustomers() {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    return mockCustomers;
  }

  // Product methods
  async getProducts() {
    await new Promise(resolve => setTimeout(resolve, 500));
    return mockProducts;
  }

  // Order methods
  async getOrders() {
    await new Promise(resolve => setTimeout(resolve, 500));
    return mockOrders;
  }

  // Invoice methods
  async getInvoices() {
    await new Promise(resolve => setTimeout(resolve, 500));
    return mockInvoices;
  }

  // Analytics methods
  async getAnalytics() {
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      totalRevenue: mockInvoices.reduce((sum, inv) => sum + inv.amount, 0),
      totalOrders: mockOrders.length,
      totalCustomers: mockCustomers.length,
      averageOrderValue: mockOrders.reduce((sum, order) => sum + order.total, 0) / mockOrders.length
    };
  }

  // Real CRM data methods
  async getProjects() {
    try {
      return await getProjects();
    } catch (error) {
      console.error('Error getting projects:', error);
      return [];
    }
  }

  async getTenders() {
    try {
      return await getTenders();
    } catch (error) {
      console.error('Error getting tenders:', error);
      return [];
    }
  }

  async getEmployees() {
    try {
      return await getEmployees();
    } catch (error) {
      console.error('Error getting employees:', error);
      return [];
    }
  }

  async getRegistrations() {
    try {
      return await getRegistrations();
    } catch (error) {
      console.error('Error getting registrations:', error);
      return [];
    }
  }

  async getPayments() {
    try {
      return await getPayments();
    } catch (error) {
      console.error('Error getting payments:', error);
      return [];
    }
  }

  async getSubscriptions() {
    try {
      return await getSubscriptions();
    } catch (error) {
      console.error('Error getting subscriptions:', error);
      return [];
    }
  }

  async getPartners() {
    try {
      return await getPartners();
    } catch (error) {
      console.error('Error getting partners:', error);
      return [];
    }
  }

  // Real-time subscription
  subscribe(callback: () => void) {
    this.subscribers.push(callback);
    
    // Simulate real-time updates
    const interval = setInterval(() => {
      callback();
    }, 10000);

    // Return unsubscribe function
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
      clearInterval(interval);
    };
  }
}

export const platformDataService = new PlatformDataService();
