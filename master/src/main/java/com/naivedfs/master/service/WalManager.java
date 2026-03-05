package com.naivedfs.master.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import javax.annotation.PreDestroy;
import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.util.List;

@Service
public class WalManager {
  private static final Logger log = LoggerFactory.getLogger(WalManager.class);

  @Value("${naivedfs.master.wal-path:./data/master-wal.log}")
  private String walFilePath;

  private BufferedWriter writer;
  private final ObjectMapper objectMapper = new ObjectMapper();

  @PostConstruct
  public void init() throws IOException {
    Path path = Paths.get(walFilePath);
    if (!Files.exists(path.getParent())) {
      Files.createDirectories(path.getParent());
    }

    // Temporary fix: Wipe WAL on restart to clear stale file metadata since block
    // reports aren't repopulating yet
    if (Files.exists(path)) {
      Files.delete(path);
      log.info("Temporary fix: Deleted existing WAL file at startup to enforce clean slate: {}", walFilePath);
    }

    // Open the WAL in append mode, create if it doesn't exist
    this.writer = Files.newBufferedWriter(path, StandardOpenOption.CREATE, StandardOpenOption.APPEND);
    log.info("Initialized Write-Ahead Log at {}", walFilePath);
  }

  /**
   * Replays the WAL to a given handler upon startup.
   */
  public void replayLog(WalReplayHandler handler) throws IOException {
    Path path = Paths.get(walFilePath);
    if (!Files.exists(path)) {
      return;
    }

    try (BufferedReader reader = Files.newBufferedReader(path)) {
      String line;
      while ((line = reader.readLine()) != null) {
        if (line.trim().isEmpty())
          continue;
        WalEntry entry = objectMapper.readValue(line, WalEntry.class);
        handler.handle(entry);
      }
    }
    log.info("Replayed WAL successfully.");
  }

  /**
   * Synchronously writes an entry to the WAL.
   */
  public synchronized void writeEntry(WalEntry entry) {
    try {
      String json = objectMapper.writeValueAsString(entry);
      writer.write(json);
      writer.newLine();
      writer.flush(); // Ensure it hits the disk
    } catch (IOException e) {
      log.error("Failed to write to WAL!", e);
      throw new RuntimeException("WAL Write Failure", e);
    }
  }

  @PreDestroy
  public void close() {
    if (writer != null) {
      try {
        writer.close();
      } catch (IOException e) {
        log.error("Failed to close WAL writer", e);
      }
    }
  }

  public static class WalEntry {
    public String operation;
    public String filename;
    public List<String> blockIds;
    public long timestamp;

    public WalEntry() {
    } // default constructor for Jackson

    public WalEntry(String operation, String filename, List<String> blockIds) {
      this.operation = operation;
      this.filename = filename;
      this.blockIds = blockIds;
      this.timestamp = System.currentTimeMillis();
    }
  }

  public interface WalReplayHandler {
    void handle(WalEntry entry);
  }
}
