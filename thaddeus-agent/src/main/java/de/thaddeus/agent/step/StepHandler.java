package de.thaddeus.agent.step;

/**
 * SPI for deployment step handlers. Each step type registers one implementation.
 */
public interface StepHandler {
    String type();
    void execute(StepContext ctx) throws Exception;
}
