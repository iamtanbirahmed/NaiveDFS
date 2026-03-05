package com.naivedfs.datanode.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

import javax.annotation.PostConstruct;
import java.net.InetAddress;
import java.util.UUID;

@Configuration
public class DataNodeConfig {

  // We generate a random UUID for the DataNode if none is provided.
  // In a real scenario, this would be persisted on disk so restarted nodes
  // maintain their identity.
  @Value("${DATA_NODE_ID:#{T(java.util.UUID).randomUUID().toString()}}")
  private String nodeId;

  @Value("${grpc.server.port:9091}")
  private int port;

  private String ipAddress;

  @PostConstruct
  public void init() {
    try {
      ipAddress = InetAddress.getLocalHost().getHostAddress();
    } catch (Exception e) {
      ipAddress = "127.0.0.1";
    }
  }

  public String getNodeId() {
    return nodeId;
  }

  public int getPort() {
    return port;
  }

  public String getIpAddress() {
    return ipAddress;
  }
}
