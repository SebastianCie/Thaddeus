package de.thaddeus.agent.step.substitution;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import de.thaddeus.agent.log.TaskLogger;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.nio.charset.Charset;
import java.nio.file.*;
import java.util.*;

/**
 * Issue #18 — JSON variable substitution using dot-notation paths.
 * Example: "ConnectionStrings.Default" → sets json["ConnectionStrings"]["Default"]
 * Array indices supported: "Logging.Targets.0.MinLevel"
 */
@ApplicationScoped
public class JsonSubstitution {

    @Inject TaskLogger taskLogger;

    private static final ObjectMapper MAPPER = new ObjectMapper();

    public int substitute(String taskId, Path file, Map<String, String> variables,
                          Set<String> secretNames) throws Exception {
        byte[] originalBytes = Files.readAllBytes(file);

        // Detect BOM
        boolean hasBom = originalBytes.length >= 3
                && (originalBytes[0] & 0xFF) == 0xEF
                && (originalBytes[1] & 0xFF) == 0xBB
                && (originalBytes[2] & 0xFF) == 0xBF;

        String content = hasBom
                ? new String(originalBytes, 3, originalBytes.length - 3, java.nio.charset.StandardCharsets.UTF_8)
                : new String(originalBytes, java.nio.charset.StandardCharsets.UTF_8);

        boolean crlf = content.contains("\r\n");

        JsonNode root;
        try {
            root = MAPPER.readTree(content);
        } catch (Exception e) {
            throw new RuntimeException("Invalid JSON in " + file.getFileName() + ": " + e.getMessage());
        }

        int count = 0;
        for (Map.Entry<String, String> entry : variables.entrySet()) {
            String path = entry.getKey();
            String value = entry.getValue();
            if (setByPath(root, path, value)) {
                count++;
                String displayVal = secretNames.contains(path) ? "***" : value;
                taskLogger.info(taskId, "JSON substitution: " + path + " = " + displayVal + " in " + file.getFileName());
            }
        }

        if (count > 0) {
            String newContent = MAPPER.writerWithDefaultPrettyPrinter().writeValueAsString(root);
            if (!crlf) newContent = newContent.replace("\r\n", "\n");
            byte[] newBytes = newContent.getBytes(java.nio.charset.StandardCharsets.UTF_8);
            if (hasBom) {
                byte[] withBom = new byte[3 + newBytes.length];
                withBom[0] = (byte) 0xEF;
                withBom[1] = (byte) 0xBB;
                withBom[2] = (byte) 0xBF;
                System.arraycopy(newBytes, 0, withBom, 3, newBytes.length);
                Files.write(file, withBom);
            } else {
                Files.write(file, newBytes);
            }
        }

        return count;
    }

    private boolean setByPath(JsonNode root, String dotPath, String value) {
        String[] parts = dotPath.split("\\.");
        JsonNode current = root;

        for (int i = 0; i < parts.length - 1; i++) {
            String part = parts[i];
            JsonNode next = isIndex(part)
                    ? (current.isArray() ? current.get(Integer.parseInt(part)) : null)
                    : current.get(part);
            if (next == null || next.isNull() || next.isMissingNode()) return false;
            current = next;
        }

        String lastPart = parts[parts.length - 1];

        if (current.isObject()) {
            ObjectNode obj = (ObjectNode) current;
            JsonNode existing = obj.get(lastPart);
            if (existing == null) return false;
            if (existing.isBoolean()) obj.put(lastPart, Boolean.parseBoolean(value));
            else if (existing.isNumber()) {
                try { obj.put(lastPart, Long.parseLong(value)); }
                catch (NumberFormatException e) { obj.put(lastPart, Double.parseDouble(value)); }
            } else {
                obj.put(lastPart, value);
            }
            return true;
        }

        if (current.isArray() && isIndex(lastPart)) {
            int idx = Integer.parseInt(lastPart);
            ArrayNode arr = (ArrayNode) current;
            if (idx >= arr.size()) return false;
            arr.set(idx, MAPPER.valueToTree(value));
            return true;
        }

        return false;
    }

    private boolean isIndex(String s) {
        try { Integer.parseInt(s); return true; } catch (NumberFormatException e) { return false; }
    }
}
