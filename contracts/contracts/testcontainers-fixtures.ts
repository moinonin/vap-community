/**
 * Integration Test Fixtures (S4.1)
 * Testcontainers for Postgres, Redis, Kafka.
 * Requires testcontainers dependencies (install separately for full use).
 */

export const fixtures = {
  postgres: {
    image: 'postgres:16-alpine',
    env: { POSTGRES_USER: 'test', POSTGRES_PASSWORD: 'test', POSTGRES_DB: 'test' },
    ports: { 5432: 5432 },
    health: 'pg_isready -U test'
  },
  redis: {
    image: 'redis:7-alpine',
    ports: { 6379: 6379 },
    health: 'redis-cli ping'
  },
  kafka: {
    image: 'confluentinc/cp-kafka:7.6.0',
    env: { KAFKA_ZOOKEEPER_CONNECT: 'zookeeper:2181' },
    ports: { 9092: 9092 }
  },
  zookeeper: {
    image: 'confluentinc/cp-zookeeper:7.6.0',
    env: { ZOOKEEPER_CLIENT_PORT: '2181' },
    ports: { 2181: 2181 }
  }
};

export const integrationBaseUrl = process.env.INTEGRATION_BASE_URL || 'http://localhost:3000';
