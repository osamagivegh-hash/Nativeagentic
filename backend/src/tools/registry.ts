// ===========================================
// NEXUS AI PLATFORM - TOOL REGISTRY
// Central registry for all agent tools
// ===========================================

import { z } from 'zod';
import { logger } from '../utils/logger.js';
import {
  Tool,
  ToolCategory,
  ToolContext,
  ToolResult,
  JSONObject
} from '../types/index.js';

// Import all tools
import { databaseTools } from './database-tools.js';
import { calculationTools } from './calculation-tools.js';
import { reportTools } from './report-tools.js';
import { workflowTools } from './workflow-tools.js';
import { analysisTools } from './analysis-tools.js';

// ===========================================
// TOOL REGISTRY CLASS
// ===========================================

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();
  private categoryIndex: Map<ToolCategory, string[]> = new Map();

  constructor() {
    this.registerAllTools();
  }

  private registerAllTools(): void {
    // Register all tool modules
    const allTools: Tool[] = [
      ...databaseTools,
      ...calculationTools,
      ...reportTools,
      ...workflowTools,
      ...analysisTools
    ];

    for (const tool of allTools) {
      this.register(tool);
    }

    logger.info({ toolCount: this.tools.size }, 'Tool registry initialized');
  }

  // ===========================================
  // REGISTRATION
  // ===========================================

  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      logger.warn({ toolName: tool.name }, 'Tool already registered, overwriting');
    }

    this.tools.set(tool.name, tool);

    // Update category index
    const categoryTools = this.categoryIndex.get(tool.category) || [];
    categoryTools.push(tool.name);
    this.categoryIndex.set(tool.category, categoryTools);

    logger.debug({ toolName: tool.name, category: tool.category }, 'Tool registered');
  }

  unregister(toolName: string): boolean {
    const tool = this.tools.get(toolName);
    if (!tool) return false;

    this.tools.delete(toolName);

    // Update category index
    const categoryTools = this.categoryIndex.get(tool.category) || [];
    const index = categoryTools.indexOf(toolName);
    if (index > -1) {
      categoryTools.splice(index, 1);
    }

    return true;
  }

  // ===========================================
  // RETRIEVAL
  // ===========================================

  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getToolsByCategory(category: ToolCategory): Tool[] {
    const toolNames = this.categoryIndex.get(category) || [];
    return toolNames
      .map(name => this.tools.get(name))
      .filter((t): t is Tool => t !== undefined);
  }

  getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  // ===========================================
  // EXECUTION
  // ===========================================

  async executeTool(
    name: string,
    params: JSONObject,
    context: ToolContext
  ): Promise<ToolResult> {
    const tool = this.tools.get(name);

    if (!tool) {
      return {
        success: false,
        error: `Tool not found: ${name}`
      };
    }

    // Check permissions
    if (!this.hasPermissions(tool, context)) {
      return {
        success: false,
        error: `Insufficient permissions for tool: ${name}`
      };
    }

    // Validate input
    const validationResult = this.validateInput(tool, params);
    if (!validationResult.success) {
      return {
        success: false,
        error: `Invalid parameters: ${validationResult.error}`
      };
    }

    // Execute with timeout
    try {
      const result = await this.executeWithTimeout(
        tool.execute(params, context),
        context.timeout
      );

      // Validate output
      if (result.success && result.data) {
        const outputValid = this.validateOutput(tool, result.data);
        if (!outputValid.success) {
          logger.warn({ toolName: name }, 'Tool output validation failed');
        }
      }

      return result;
    } catch (error) {
      logger.error({ toolName: name, error }, 'Tool execution failed');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Tool execution failed'
      };
    }
  }

  // ===========================================
  // VALIDATION
  // ===========================================

  private validateInput(tool: Tool, params: JSONObject): { success: boolean; error?: string } {
    try {
      tool.inputSchema.parse(params);
      return { success: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: (error as any).errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ')
        };
      }
      return { success: false, error: 'Validation failed' };
    }
  }

  private validateOutput(tool: Tool, output: unknown): { success: boolean } {
    try {
      tool.outputSchema.parse(output);
      return { success: true };
    } catch {
      return { success: false };
    }
  }

  private hasPermissions(tool: Tool, context: ToolContext): boolean {
    if (tool.requiresPermission.length === 0) return true;

    return tool.requiresPermission.every(perm =>
      context.permissions.includes(perm) || context.permissions.includes('admin')
    );
  }

  // ===========================================
  // HELPERS
  // ===========================================

  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeout: number
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Tool execution timeout')), timeout)
      )
    ]);
  }

  // ===========================================
  // TOOL DISCOVERY
  // ===========================================

  describeTools(): Array<{
    name: string;
    description: string;
    category: ToolCategory;
    riskLevel: string;
  }> {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      category: tool.category,
      riskLevel: tool.riskLevel
    }));
  }

  getToolSchema(name: string): JSONObject | null {
    const tool = this.tools.get(name);
    if (!tool) return null;

    return {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema
    };
  }
}

// ===========================================
// SINGLETON INSTANCE
// ===========================================

let toolRegistryInstance: ToolRegistry | null = null;

export function getToolRegistry(): ToolRegistry {
  if (!toolRegistryInstance) {
    toolRegistryInstance = new ToolRegistry();
  }
  return toolRegistryInstance;
}






