package de.thaddeus.agent.step.substitution;

import de.thaddeus.agent.log.TaskLogger;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;
import org.w3c.dom.*;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.transform.*;
import javax.xml.transform.dom.DOMSource;
import javax.xml.transform.stream.StreamResult;
import javax.xml.xpath.*;
import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.Set;

/**
 * Issue #19 — XML variable substitution.
 * Two modes:
 *   1. appSettings convention: key "MyKey" replaces value of <add key="MyKey" value="..."/>
 *   2. XPath mode: key starting with // treated as XPath expression targeting an attribute
 */
@ApplicationScoped
public class XmlSubstitution {

    private static final Logger log = Logger.getLogger(XmlSubstitution.class);

    @Inject TaskLogger taskLogger;

    public int substitute(String taskId, Path file, Map<String, String> variables,
                          Set<String> secretNames) throws Exception {
        byte[] originalBytes = Files.readAllBytes(file);
        String originalContent = new String(originalBytes);

        // Detect encoding declaration
        boolean hasBom = originalBytes.length >= 3
                && (originalBytes[0] & 0xFF) == 0xEF
                && (originalBytes[1] & 0xFF) == 0xBB
                && (originalBytes[2] & 0xFF) == 0xBF;
        boolean crlf = originalContent.contains("\r\n");

        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(true);
        // Disable external entity processing (XXE prevention)
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", false);
        factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
        factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);

        Document doc;
        try {
            DocumentBuilder builder = factory.newDocumentBuilder();
            doc = builder.parse(new ByteArrayInputStream(originalBytes));
        } catch (Exception e) {
            throw new RuntimeException("Invalid XML in " + file.getFileName() + ": " + e.getMessage());
        }

        XPathFactory xpathFactory = XPathFactory.newInstance();
        XPath xpath = xpathFactory.newXPath();

        int count = 0;
        for (Map.Entry<String, String> entry : variables.entrySet()) {
            String key = entry.getKey();
            String value = entry.getValue();
            String displayVal = secretNames.contains(key) ? "***" : value;

            boolean replaced;
            if (key.startsWith("//") || key.startsWith("/")) {
                // XPath mode
                replaced = replaceByXPath(doc, xpath, key, value);
            } else {
                // appSettings convention
                replaced = replaceAppSetting(doc, xpath, key, value);
            }

            if (replaced) {
                count++;
                taskLogger.info(taskId, "XML substitution: " + key + " = " + displayVal + " in " + file.getFileName());
            }
        }

        if (count > 0) {
            StringWriter sw = new StringWriter();
            Transformer transformer = TransformerFactory.newInstance().newTransformer();
            transformer.setOutputProperty(OutputKeys.INDENT, "yes");
            transformer.setOutputProperty(OutputKeys.ENCODING, "UTF-8");
            transformer.transform(new DOMSource(doc), new StreamResult(sw));
            String newContent = sw.toString();
            if (!crlf) newContent = newContent.replace("\r\n", "\n");
            byte[] newBytes = newContent.getBytes(java.nio.charset.StandardCharsets.UTF_8);
            if (hasBom) {
                byte[] withBom = new byte[3 + newBytes.length];
                withBom[0] = (byte) 0xEF; withBom[1] = (byte) 0xBB; withBom[2] = (byte) 0xBF;
                System.arraycopy(newBytes, 0, withBom, 3, newBytes.length);
                Files.write(file, withBom);
            } else {
                Files.write(file, newBytes);
            }
        }

        return count;
    }

    private boolean replaceByXPath(Document doc, XPath xpath, String expression, String value) {
        try {
            NodeList nodes = (NodeList) xpath.evaluate(expression, doc, XPathConstants.NODESET);
            if (nodes.getLength() == 0) return false;
            for (int i = 0; i < nodes.getLength(); i++) {
                Node node = nodes.item(i);
                if (node.getNodeType() == Node.ATTRIBUTE_NODE) {
                    node.setNodeValue(value);
                } else {
                    node.setTextContent(value);
                }
            }
            return true;
        } catch (XPathExpressionException e) {
            return false;
        }
    }

    private boolean replaceAppSetting(Document doc, XPath xpath, String key, String value) {
        try {
            String expr = "//add[@key='" + key + "']";
            NodeList nodes = (NodeList) xpath.evaluate(expr, doc, XPathConstants.NODESET);
            if (nodes.getLength() == 0) return false;
            for (int i = 0; i < nodes.getLength(); i++) {
                Element el = (Element) nodes.item(i);
                el.setAttribute("value", value);
            }
            return true;
        } catch (XPathExpressionException e) {
            return false;
        }
    }
}
