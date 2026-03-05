package com.naivedfs.master.service;

import com.naivedfs.grpc.DataNodeInfo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
public class DataNodeRegistry {
    private static final Logger log = LoggerFactory.getLogger(DataNodeRegistry.class);
    private static final long HEARTBEAT_TIMEOUT_MS = 15000; // 15 seconds

    private final Map<String, DataNodeState> dataNodes = new ConcurrentHashMap<>();

    public void registerNode(String nodeId, String ipAddress, int port) {
        DataNodeInfo info = DataNodeInfo.newBuilder()
                .setDataNodeId(nodeId)
                .setIpAddress(ipAddress)
                .setPort(port)
                .build();

        dataNodes.put(nodeId, new DataNodeState(info, Instant.now(), 0));
        log.info("Registered DataNode: {} at {}:{}", nodeId, ipAddress, port);
    }

    public boolean updateHeartbeat(String nodeId, long freeSpaceBytes) {
        DataNodeState state = dataNodes.get(nodeId);
        if (state != null) {
            state.lastHeartbeat = Instant.now();
            state.freeSpaceBytes = freeSpaceBytes;
            log.debug("Heartbeat received from DataNode: {}. Free space: {} bytes", nodeId, freeSpaceBytes);
            return true;
        } else {
            log.warn("Heartbeat received from unknown DataNode: {}. Please register first.", nodeId);
            return false;
        }
    }

    public List<DataNodeInfo> getActiveDataNodes() {
        return dataNodes.values().stream()
                .map(state -> state.info)
                .collect(Collectors.toList());
    }

    public long getFreeSpace(String nodeId) {
        DataNodeState state = dataNodes.get(nodeId);
        return state != null ? state.freeSpaceBytes : 0L;
    }

    public DataNodeInfo getNodeInfo(String nodeId) {
        DataNodeState state = dataNodes.get(nodeId);
        return state != null ? state.info : null;
    }

    // Runs every 5 seconds to evict dead nodes
    @Scheduled(fixedRate = 5000)
    public void checkNodeHealth() {
        Instant now = Instant.now();
        List<String> deadNodes = new ArrayList<>();

        dataNodes.forEach((nodeId, state) -> {
            if (now.toEpochMilli() - state.lastHeartbeat.toEpochMilli() > HEARTBEAT_TIMEOUT_MS) {
                deadNodes.add(nodeId);
            }
        });

        for (String deadNode : deadNodes) {
            log.warn("DataNode {} has timed out. Removing from registry.", deadNode);
            dataNodes.remove(deadNode);
            // TODO: In a real implementation, we should trigger block replication for
            // blocks that were on this node
        }
    }

    private static class DataNodeState {
        DataNodeInfo info;
        Instant lastHeartbeat;
        long freeSpaceBytes;

        DataNodeState(DataNodeInfo info, Instant lastHeartbeat, long freeSpaceBytes) {
            this.info = info;
            this.lastHeartbeat = lastHeartbeat;
            this.freeSpaceBytes = freeSpaceBytes;
        }
    }
}
