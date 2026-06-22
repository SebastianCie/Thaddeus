package de.thaddeus.agent.log;

import java.time.Instant;
import java.util.List;

public record LogBatch(List<LogEntry> entries) {
    public record LogEntry(Instant timestamp, String level, String message) {}
}
