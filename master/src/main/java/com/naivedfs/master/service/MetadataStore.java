package com.naivedfs.master.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class MetadataStore implements WalManager.WalReplayHandler {
  private static final Logger log = LoggerFactory.getLogger(MetadataStore.class);

  private final WalManager walManager;

  // Maps filename -> List of Block IDs
  private final Map<String, List<String>> fileToBlocksMap = new ConcurrentHashMap<>();

  // Maps Block ID -> Filename (useful for reverse lookups if needed)
  private final Map<String, String> blockToFileMap = new ConcurrentHashMap<>();

  @Autowired
  public MetadataStore(WalManager walManager) {
    this.walManager = walManager;
  }

  @PostConstruct
  public void init() {
    log.info("Initializing MetadataStore - Replaying WAL...");
    try {
      walManager.replayLog(this);
    } catch (IOException e) {
      log.error("Failed to replay WAL, startup aborted!", e);
      throw new RuntimeException(e);
    }
  }

  /**
   * Replays internal states from the WAL
   */
  @Override
  public void handle(WalManager.WalEntry entry) {
    if ("CREATE_FILE".equals(entry.operation)) {
      fileToBlocksMap.put(entry.filename, new ArrayList<>(entry.blockIds));
      for (String blockId : entry.blockIds) {
        blockToFileMap.put(blockId, entry.filename);
      }
      log.debug("Replayed CREATE_FILE for {}", entry.filename);
    } else if ("DELETE_FILE".equals(entry.operation)) {
      List<String> removedBlocks = fileToBlocksMap.remove(entry.filename);
      if (removedBlocks != null) {
        for (String blockId : removedBlocks) {
          blockToFileMap.remove(blockId);
        }
      }
      log.debug("Replayed DELETE_FILE for {}", entry.filename);
    }
  }

  public boolean fileExists(String filename) {
    return fileToBlocksMap.containsKey(filename);
  }

  public java.util.Set<String> getAllFiles() {
    return fileToBlocksMap.keySet();
  }

  public List<String> getFileBlocks(String filename) {
    return fileToBlocksMap.get(filename);
  }

  /**
   * Persist a new file creation, writing to WAL synchronously.
   */
  public synchronized void createFile(String filename, List<String> blockIds) {
    if (fileExists(filename)) {
      throw new IllegalArgumentException("File already exists: " + filename);
    }

    // 1. Write to WAL
    WalManager.WalEntry entry = new WalManager.WalEntry("CREATE_FILE", filename, blockIds);
    walManager.writeEntry(entry);

    // 2. Update memory state
    fileToBlocksMap.put(filename, new ArrayList<>(blockIds));
    for (String blockId : blockIds) {
      blockToFileMap.put(blockId, filename);
    }

    log.info("Created file metadata for {} with {} blocks.", filename, blockIds.size());
  }

  // Dynamic state (NOT WAL-backed because it's ephemeral)
  // Block ID -> List of DataNode IDs where the block lives
  private final Map<String, List<String>> blockLocationMap = new ConcurrentHashMap<>();

  public void updateBlockLocation(String blockId, String dataNodeId) {
    blockLocationMap.computeIfAbsent(blockId, k -> new ArrayList<>()).add(dataNodeId);
  }

  public List<String> getBlockLocations(String blockId) {
    return blockLocationMap.getOrDefault(blockId, new ArrayList<>());
  }
}
