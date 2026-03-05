package com.naivedfs.datanode.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
public class StorageService {
  private static final Logger log = LoggerFactory.getLogger(StorageService.class);

  @Value("${naivedfs.datanode.storage-path:./data/blocks}")
  private String storagePath;

  @PostConstruct
  public void init() throws IOException {
    Path path = Paths.get(storagePath);
    if (!Files.exists(path)) {
      Files.createDirectories(path);
    } else {
      // Temporary fix: wipe block data on restart to avoid orphaned blocks
      try (Stream<Path> stream = Files.list(path)) {
        stream.forEach(file -> {
          try {
            Files.delete(file);
          } catch (IOException e) {
            log.error("Failed to delete stale block file: {}", file);
          }
        });
      }
      log.info("Temporary fix: Deleted existing block chunks at startup to enforce clean slate");
    }
    log.info("Initialized DataNode storage at {}", path.toAbsolutePath());
  }

  public synchronized void writeBlock(String blockId, byte[] data) throws IOException {
    Path filePath = Paths.get(storagePath, blockId);
    Files.write(filePath, data);
    log.debug("Wrote block {} to disk ({} bytes)", blockId, data.length);
  }

  public byte[] readBlock(String blockId) throws IOException {
    Path filePath = Paths.get(storagePath, blockId);
    if (!Files.exists(filePath)) {
      throw new FileNotFoundException("Block not found: " + blockId);
    }
    return Files.readAllBytes(filePath);
  }

  public long getFreeSpace() {
    return new File(storagePath).getUsableSpace();
  }

  public List<String> getAllBlockIds() {
    try (Stream<Path> stream = Files.list(Paths.get(storagePath))) {
      return stream
          .filter(file -> !Files.isDirectory(file))
          .map(Path::getFileName)
          .map(Path::toString)
          .collect(Collectors.toList());
    } catch (IOException e) {
      log.error("Failed to list blocks", e);
      return List.of();
    }
  }
}
