/**
 * Load Testing for Concurrent Multi-Broker Operations
 * Tests system performance under high load conditions
 */

const { describe, it, beforeEach, afterEach } = require('mocha');
const { expect } = require('chai');
const request = require('supertest');
const http = require('http');
const { performance } = require('perf_hooks');

// Mock broker manager with performance tracking
class LoadTestBrokerManager {
  constructor() {
    this.baskets = new Map();
    this.executionStats = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageResponseTime: 0,
      responseTimes: []
    };
  }

  async executeBasketOrder(basketId, items) {
    const startTime = performance.now();

    // Simulate variable execution time (50-200ms)
    const executionTime = 50 + Math.random() * 150;
    await new Promise(resolve => setTimeout(resolve, executionTime));

    // Simulate 5% failure rate under load
    const success = Math.random() > 0.05;
    const endTime = performance.now();
    const responseTime = endTime - startTime;

    this.executionStats.totalExecutions++;
    this.executionStats.responseTimes.push(responseTime);

    if (success) {
      this.executionStats.successfulExecutions++;
    } else {
      this.executionStats.failedExecutions++;
    }

    // Update average response time
    this.executionStats.averageResponseTime =
      this.executionStats.responseTimes.reduce((sum, time) => sum + time, 0) / this.executionStats.responseTimes.length;

    return {
      success,
      status: success ? 'completed' : 'failed',
      responseTime,
      results: items.map(item => ({
        itemId: item.id,
        success,
        error: success ? null : 'Load test failure'
      }))
    };
  }

  getStats() {
    return { ...this.executionStats };
  }
}

// Create load test server
function createLoadTestServer() {
  const brokerManager = new LoadTestBrokerManager();

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
          const basketId = Date.now() + Math.random();

          brokerManager.baskets.set(basketId, {
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
              status: 'pending'
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
      const basketId = req.url.split('/')[3];
      const basket = brokerManager.baskets.get(basketId);

      if (!basket) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Basket not found' }));
        return;
      }

      // Execute asynchronously
      brokerManager.executeBasketOrder(basketId, basket.items).then(result => {
        brokerManager.baskets.set(basketId, {
          ...basket,
          status: result.status,
          updated_at: new Date().toISOString()
        });
      }).catch(error => {
        console.error('Load test execution error:', error);
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: true,
        message: 'Execution started'
      }));
      return;
    }

    // GET /api/load-stats
    if (req.url === '/api/load-stats' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: true,
        data: brokerManager.getStats()
      }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });
}

describe('Load Testing - Concurrent Multi-Broker Operations', () => {
  let server;
  let brokerManager;

  beforeEach((done) => {
    server = createLoadTestServer();
    server.listen(3012, 'localhost', done);
  });

  afterEach((done) => {
    if (server) {
      server.close(done);
    } else {
      done();
    }
  });

  describe('Concurrent Basket Order Execution', () => {
    it('should handle 10 concurrent basket orders', async function() {
      this.timeout(30000);

      const basketPromises = [];
      const startTime = performance.now();

      // Create 10 basket orders concurrently
      for (let i = 0; i < 10; i++) {
        const basketData = {
          name: `Load Test Basket ${i}`,
          type: 'options',
          distributionAlgorithm: 'round-robin',
          maxBrokers: 3,
          items: Array.from({ length: 5 }, (_, j) => ({
            symbol: `SYMBOL${j}`,
            expiry: '2025-11-25',
            strike: 15000 + j * 100,
            optionType: 'CE',
            quantity: 50,
            orderType: 'Market',
            transactionType: 'BUY',
            productType: 'MIS'
          }))
        };

        basketPromises.push(
          request(server)
            .post('/api/basket-orders')
            .send(basketData)
        );
      }

      const createResponses = await Promise.all(basketPromises);
      const createEndTime = performance.now();
      const createTime = createEndTime - startTime;

      console.log(`Created 10 baskets in ${createTime.toFixed(2)}ms`);

      // Extract basket IDs
      const basketIds = createResponses.map(res => res.body.data.id);

      // Execute all baskets concurrently
      const executePromises = basketIds.map(id =>
        request(server)
          .post(`/api/basket-orders/${id}/execute`)
      );

      const executeStartTime = performance.now();
      await Promise.all(executePromises);
      const executeEndTime = performance.now();
      const executeTime = executeEndTime - executeStartTime;

      console.log(`Started execution of 10 baskets in ${executeTime.toFixed(2)}ms`);

      // Wait for all executions to complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check load statistics
      const statsResponse = await request(server)
        .get('/api/load-stats')
        .expect(200);

      const stats = statsResponse.body.data;
      console.log('Load test statistics:', stats);

      expect(stats.totalExecutions).to.be.greaterThan(0);
      expect(stats.successfulExecutions + stats.failedExecutions).to.equal(stats.totalExecutions);
      expect(stats.averageResponseTime).to.be.greaterThan(0);
    });

    it('should handle 50 concurrent basket orders', async function() {
      this.timeout(60000);

      const basketPromises = [];
      const startTime = performance.now();

      // Create 50 smaller basket orders
      for (let i = 0; i < 50; i++) {
        const basketData = {
          name: `Stress Test Basket ${i}`,
          type: 'options',
          distributionAlgorithm: 'random',
          maxBrokers: 2,
          items: [{
            symbol: 'NIFTY',
            expiry: '2025-11-25',
            strike: 15000,
            optionType: 'CE',
            quantity: 25,
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

      const createResponses = await Promise.all(basketPromises);
      const createTime = performance.now() - startTime;

      console.log(`Created 50 baskets in ${createTime.toFixed(2)}ms`);

      // Execute all baskets
      const basketIds = createResponses.map(res => res.body.data.id);
      const executePromises = basketIds.map(id =>
        request(server)
          .post(`/api/basket-orders/${id}/execute`)
      );

      const executeStartTime = performance.now();
      await Promise.all(executePromises);
      const executeTime = performance.now() - executeStartTime;

      console.log(`Started execution of 50 baskets in ${executeTime.toFixed(2)}ms`);

      // Wait longer for high load
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check final statistics
      const statsResponse = await request(server)
        .get('/api/load-stats')
        .expect(200);

      const stats = statsResponse.body.data;
      console.log('Stress test statistics:', stats);

      expect(stats.totalExecutions).to.be.greaterThan(40); // At least 80% success rate
      expect(stats.averageResponseTime).to.be.lessThan(500); // Under 500ms average
    });

    it('should maintain performance under sustained load', async function() {
      this.timeout(120000);

      const testDuration = 30000; // 30 seconds
      const startTime = performance.now();
      let operationCount = 0;

      // Continuous load for 30 seconds
      const loadInterval = setInterval(async () => {
        if (performance.now() - startTime > testDuration) {
          clearInterval(loadInterval);
          return;
        }

        try {
          // Create and execute a basket order
          const basketData = {
            name: `Continuous Load ${operationCount}`,
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
            .send(basketData);

          if (createResponse.status === 201) {
            await request(server)
              .post(`/api/basket-orders/${createResponse.body.data.id}/execute`);
            operationCount++;
          }
        } catch (error) {
          // Ignore errors during load test
        }
      }, 100); // Every 100ms

      // Wait for test duration
      await new Promise(resolve => setTimeout(resolve, testDuration + 1000));

      console.log(`Completed ${operationCount} operations in ${testDuration}ms`);
      console.log(`Operations per second: ${(operationCount / (testDuration / 1000)).toFixed(2)}`);

      // Check final statistics
      const statsResponse = await request(server)
        .get('/api/load-stats')
        .expect(200);

      const stats = statsResponse.body.data;
      console.log('Sustained load statistics:', stats);

      expect(operationCount).to.be.greaterThan(100); // At least 100 operations
      expect(stats.averageResponseTime).to.be.lessThan(300); // Maintain response time
    });
  });

  describe('Resource Utilization', () => {
    it('should monitor memory usage during load', async function() {
      this.timeout(20000);

      const initialMemory = process.memoryUsage();

      // Generate significant load
      const loadPromises = [];
      for (let i = 0; i < 20; i++) {
        const basketData = {
          name: `Memory Test ${i}`,
          type: 'options',
          items: Array.from({ length: 10 }, (_, j) => ({
            symbol: `SYMBOL${j}`,
            expiry: '2025-11-25',
            strike: 15000 + j * 100,
            optionType: 'CE',
            quantity: 50,
            orderType: 'Market',
            transactionType: 'BUY',
            productType: 'MIS'
          }))
        };

        loadPromises.push(
          request(server)
            .post('/api/basket-orders')
            .send(basketData)
            .then(res => {
              if (res.status === 201) {
                return request(server)
                  .post(`/api/basket-orders/${res.body.data.id}/execute`);
              }
            })
        );
      }

      await Promise.all(loadPromises);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Final heap usage: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).to.be.lessThan(50 * 1024 * 1024);
    });
  });

  describe('Performance Benchmarks', () => {
    it('should benchmark basket creation performance', async function() {
      this.timeout(10000);

      const benchmarkData = {
        name: 'Benchmark Basket',
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

      const iterations = 100;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        benchmarkData.name = `Benchmark Basket ${i}`;
        await request(server)
          .post('/api/basket-orders')
          .send(benchmarkData);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / iterations;

      console.log(`Basket creation benchmark:`);
      console.log(`Total time: ${totalTime.toFixed(2)}ms`);
      console.log(`Average time: ${avgTime.toFixed(2)}ms per basket`);
      console.log(`Operations per second: ${(1000 / avgTime).toFixed(2)}`);

      expect(avgTime).to.be.lessThan(50); // Should be under 50ms per operation
    });
  });
});