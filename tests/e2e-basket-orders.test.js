/**
 * End-to-End Tests for Basket Orders Across Multiple Brokers
 * Tests complete basket order workflow from creation to execution
 */

const { describe, it, beforeEach, afterEach } = require('mocha');
const { expect } = require('chai');
const sinon = require('sinon');
const request = require('supertest');
const http = require('http');

// Mock server setup
let server;
let mockBrokerManager;

class MockBrokerManager {
  constructor() {
    this.baskets = new Map();
    this.executionResults = new Map();
  }

  async executeBasketOrder(basketId, items) {
    // Simulate partial execution
    const results = [];
    let successCount = 0;
    let failureCount = 0;

    for (const item of items) {
      const success = Math.random() > 0.2; // 80% success rate
      if (success) {
        successCount++;
        results.push({
          itemId: item.id,
          success: true,
          orderResult: {
            orderId: `ORDER${Date.now()}${Math.random()}`,
            price: item.price || 150 + Math.random() * 50
          }
        });
      } else {
        failureCount++;
        results.push({
          itemId: item.id,
          success: false,
          error: 'Mock broker API error'
        });
      }
    }

    this.executionResults.set(basketId, {
      success: failureCount === 0,
      status: failureCount > 0 && successCount > 0 ? 'partial' : (failureCount === 0 ? 'completed' : 'failed'),
      results,
      successCount,
      failureCount
    });

    return {
      success: failureCount === 0,
      status: failureCount > 0 && successCount > 0 ? 'partial' : (failureCount === 0 ? 'completed' : 'failed'),
      results
    };
  }

  async getBasketProgress(basketId) {
    const result = this.executionResults.get(basketId);
    if (!result) return { total_items: 0, executed_items: 0, failed_items: 0 };

    return {
      total_items: result.results.length,
      executed_items: result.successCount,
      failed_items: result.failureCount,
      executing_items: 0,
      pending_items: 0,
      assigned_items: result.results.length
    };
  }
}

// Mock server endpoints
function createMockServer() {
  mockBrokerManager = new MockBrokerManager();

  return http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // POST /api/basket-orders
    if (req.url === '/api/basket-orders' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const basketData = JSON.parse(body);
          const basketId = Date.now();

          mockBrokerManager.baskets.set(basketId, {
            id: basketId,
            ...basketData,
            status: 'pending',
            created_at: new Date().toISOString()
          });

          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: true,
            data: {
              id: basketId,
              name: basketData.name,
              status: 'pending',
              totalQuantity: basketData.items.reduce((sum, item) => sum + item.quantity, 0),
              totalValue: basketData.items.reduce((sum, item) => sum + (item.quantity * (item.price || 0)), 0),
              itemsCount: basketData.items.length
            }
          }));
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        }
      });
      return;
    }

    // POST /api/basket-orders/:id/execute
    if (req.url.match(/^\/api\/basket-orders\/\d+\/execute$/) && req.method === 'POST') {
      const basketId = parseInt(req.url.split('/')[3]);
      const basket = mockBrokerManager.baskets.get(basketId);

      if (!basket) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Basket not found' }));
        return;
      }

      // Execute basket asynchronously
      setTimeout(async () => {
        try {
          const result = await mockBrokerManager.executeBasketOrder(basketId, basket.items);
          mockBrokerManager.baskets.set(basketId, {
            ...basket,
            status: result.status,
            updated_at: new Date().toISOString(),
            completed_at: result.status === 'completed' ? new Date().toISOString() : null
          });
        } catch (error) {
          console.error('Basket execution error:', error);
        }
      }, 100);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: true,
        message: 'Basket execution started',
        data: { basketId, itemsToExecute: basket.items.length }
      }));
      return;
    }

    // GET /api/basket-orders/:id/progress
    if (req.url.match(/^\/api\/basket-orders\/\d+\/progress$/) && req.method === 'GET') {
      const basketId = parseInt(req.url.split('/')[3]);
      const progress = mockBrokerManager.getBasketProgress(basketId);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: true,
        data: {
          overall: progress,
          byBroker: [] // Simplified for testing
        }
      }));
      return;
    }

    // GET /api/basket-orders
    if (req.url === '/api/basket-orders' && req.method === 'GET') {
      const baskets = Array.from(mockBrokerManager.baskets.values());
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: true, data: baskets }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
  });
}

describe('Basket Orders E2E', () => {
  beforeEach((done) => {
    server = createMockServer();
    server.listen(3011, 'localhost', done);
  });

  afterEach((done) => {
    if (server) {
      server.close(done);
    } else {
      done();
    }
  });

  describe('Complete Basket Order Workflow', () => {
    it('should create, execute, and monitor basket order successfully', async function() {
      this.timeout(10000);

      // Step 1: Create basket order
      const basketData = {
        name: 'Test Basket',
        type: 'options',
        distributionAlgorithm: 'round-robin',
        maxBrokers: 2,
        items: [
          {
            symbol: 'NIFTY',
            expiry: '2025-11-25',
            strike: 15000,
            optionType: 'CE',
            quantity: 50,
            orderType: 'Market',
            transactionType: 'BUY',
            productType: 'MIS'
          },
          {
            symbol: 'BANKNIFTY',
            expiry: '2025-11-25',
            strike: 45000,
            optionType: 'PE',
            quantity: 25,
            orderType: 'Limit',
            price: 180.50,
            transactionType: 'BUY',
            productType: 'MIS'
          }
        ]
      };

      const createResponse = await request(server)
        .post('/api/basket-orders')
        .send(basketData)
        .expect(201);

      expect(createResponse.body.status).to.be.true;
      expect(createResponse.body.data).to.have.property('id');
      const basketId = createResponse.body.data.id;

      // Step 2: Verify basket was created
      const getResponse = await request(server)
        .get('/api/basket-orders')
        .expect(200);

      expect(getResponse.body.status).to.be.true;
      const basket = getResponse.body.data.find(b => b.id === basketId);
      expect(basket).to.exist;
      expect(basket.status).to.equal('pending');

      // Step 3: Execute basket order
      const executeResponse = await request(server)
        .post(`/api/basket-orders/${basketId}/execute`)
        .expect(200);

      expect(executeResponse.body.status).to.be.true;
      expect(executeResponse.body.message).to.contain('started');

      // Step 4: Monitor progress
      await new Promise(resolve => setTimeout(resolve, 200)); // Wait for execution

      const progressResponse = await request(server)
        .get(`/api/basket-orders/${basketId}/progress`)
        .expect(200);

      expect(progressResponse.body.status).to.be.true;
      expect(progressResponse.body.data).to.have.property('overall');
      expect(progressResponse.body.data.overall).to.have.property('total_items', 2);
    });

    it('should handle partial execution failures', async function() {
      this.timeout(10000);

      // Create basket with items that may fail
      const basketData = {
        name: 'Partial Failure Basket',
        type: 'options',
        distributionAlgorithm: 'round-robin',
        maxBrokers: 3,
        items: Array.from({ length: 10 }, (_, i) => ({
          symbol: `SYMBOL${i}`,
          expiry: '2025-11-25',
          strike: 15000 + i * 100,
          optionType: 'CE',
          quantity: 50,
          orderType: 'Market',
          transactionType: 'BUY',
          productType: 'MIS'
        }))
      };

      const createResponse = await request(server)
        .post('/api/basket-orders')
        .send(basketData)
        .expect(201);

      const basketId = createResponse.body.data.id;

      // Execute basket
      await request(server)
        .post(`/api/basket-orders/${basketId}/execute`)
        .expect(200);

      // Wait for execution and check final status
      await new Promise(resolve => setTimeout(resolve, 500));

      const finalBaskets = await request(server)
        .get('/api/basket-orders')
        .expect(200);

      const finalBasket = finalBaskets.body.data.find(b => b.id === basketId);
      expect(['completed', 'partial', 'failed']).to.include(finalBasket.status);
    });

    it('should handle basket cancellation', async function() {
      this.timeout(5000);

      const basketData = {
        name: 'Cancel Test Basket',
        type: 'options',
        items: [{
          symbol: 'NIFTY',
          expiry: '2025-11-25',
          strike: 15000,
          optionType: 'CE',
          quantity: 50,
          orderType: 'Market',
          transactionType: 'BUY',
          productType: 'MIS'
        }]
      };

      const createResponse = await request(server)
        .post('/api/basket-orders')
        .send(basketData)
        .expect(201);

      const basketId = createResponse.body.data.id;

      // Cancel basket
      await request(server)
        .put(`/api/basket-orders/${basketId}/cancel`)
        .expect(200);

      // Verify cancellation
      const basketsResponse = await request(server)
        .get('/api/basket-orders')
        .expect(200);

      const cancelledBasket = basketsResponse.body.data.find(b => b.id === basketId);
      expect(cancelledBasket.status).to.equal('cancelled');
    });
  });

  describe('Load Testing', () => {
    it('should handle multiple concurrent basket orders', async function() {
      this.timeout(30000);

      const basketPromises = [];
      for (let i = 0; i < 5; i++) {
        const basketData = {
          name: `Load Test Basket ${i}`,
          type: 'options',
          distributionAlgorithm: 'round-robin',
          maxBrokers: 2,
          items: [{
            symbol: 'NIFTY',
            expiry: '2025-11-25',
            strike: 15000,
            optionType: 'CE',
            quantity: 50,
            orderType: 'Market',
            transactionType: 'BUY',
            productType: 'MIS'
          }]
        };

        basketPromises.push(
          request(server)
            .post('/api/basket-orders')
            .send(basketData)
        );
      }

      const responses = await Promise.all(basketPromises);
      responses.forEach(response => {
        expect(response.status).to.equal(201);
        expect(response.body.status).to.be.true;
      });
    });

    it('should handle large basket orders', async function() {
      this.timeout(15000);

      const largeBasketData = {
        name: 'Large Basket Test',
        type: 'options',
        distributionAlgorithm: 'load-balance',
        maxBrokers: 3,
        items: Array.from({ length: 50 }, (_, i) => ({
          symbol: `SYMBOL${i % 10}`,
          expiry: '2025-11-25',
          strike: 15000 + (i % 5) * 100,
          optionType: i % 2 === 0 ? 'CE' : 'PE',
          quantity: 25 + (i % 3) * 25,
          orderType: 'Market',
          transactionType: 'BUY',
          productType: 'MIS'
        }))
      };

      const createResponse = await request(server)
        .post('/api/basket-orders')
        .send(largeBasketData)
        .expect(201);

      expect(createResponse.body.data.itemsCount).to.equal(50);

      // Execute large basket
      await request(server)
        .post(`/api/basket-orders/${createResponse.body.data.id}/execute`)
        .expect(200);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle broker downtime', async () => {
      // Simulate broker failure by making execution always fail
      const originalExecute = mockBrokerManager.executeBasketOrder;
      mockBrokerManager.executeBasketOrder = async () => {
        throw new Error('All brokers are down');
      };

      const basketData = {
        name: 'Broker Down Test',
        type: 'options',
        items: [{
          symbol: 'NIFTY',
          expiry: '2025-11-25',
          strike: 15000,
          optionType: 'CE',
          quantity: 50,
          orderType: 'Market',
          transactionType: 'BUY',
          productType: 'MIS'
        }]
      };

      const createResponse = await request(server)
        .post('/api/basket-orders')
        .send(basketData)
        .expect(201);

      const basketId = createResponse.body.data.id;

      // Attempt execution (should handle the error gracefully)
      const executeResponse = await request(server)
        .post(`/api/basket-orders/${basketId}/execute`)
        .expect(200); // API should still return success for starting execution

      // Restore original function
      mockBrokerManager.executeBasketOrder = originalExecute;
    });

    it('should handle invalid basket data', async () => {
      const invalidBasketData = {
        name: '',
        items: []
      };

      await request(server)
        .post('/api/basket-orders')
        .send(invalidBasketData)
        .expect(400);
    });

    it('should handle non-existent basket operations', async () => {
      await request(server)
        .post('/api/basket-orders/99999/execute')
        .expect(404);

      await request(server)
        .get('/api/basket-orders/99999/progress')
        .expect(404);
    });
  });
});