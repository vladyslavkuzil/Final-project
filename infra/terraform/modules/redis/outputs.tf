output "redis_endpoint" {
  description = "DNS hostname of the Redis cache node"
  value       = aws_elasticache_cluster.this.cache_nodes[0].address
}

output "redis_port" {
  description = "Port Redis listens on"
  value       = aws_elasticache_cluster.this.cache_nodes[0].port
}
