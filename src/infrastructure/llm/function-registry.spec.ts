import { FunctionRegistry, LlmFunction } from './function-registry';

function makeFakeFunction(name: string, response: string): LlmFunction {
  return {
    definition: {
      type: 'function',
      function: {
        name,
        description: `Fake function ${name}`,
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    execute: async () => response,
  };
}

describe('FunctionRegistry', () => {
  describe('getDefinitions', () => {
    it('returns empty array when no functions are registered', () => {
      const registry = new FunctionRegistry();
      expect(registry.getDefinitions()).toHaveLength(0);
    });

    it('returns one definition after registering one function', () => {
      const registry = new FunctionRegistry();
      registry.register('fn_a', makeFakeFunction('fn_a', 'result'));
      expect(registry.getDefinitions()).toHaveLength(1);
      expect(registry.getDefinitions()[0].function.name).toBe('fn_a');
    });

    it('returns all definitions when multiple functions are registered', () => {
      const registry = new FunctionRegistry();
      registry.register('fn_a', makeFakeFunction('fn_a', 'a'));
      registry.register('fn_b', makeFakeFunction('fn_b', 'b'));
      const names = registry.getDefinitions().map((definition) => definition.function.name);
      expect(names).toContain('fn_a');
      expect(names).toContain('fn_b');
    });
  });

  describe('execute', () => {
    it('calls the registered function and returns its result', async () => {
      const registry = new FunctionRegistry();
      registry.register('my_fn', makeFakeFunction('my_fn', 'expected result'));
      const result = await registry.execute('my_fn', {});
      expect(result).toBe('expected result');
    });

    it('returns an error message when the function name is not registered', async () => {
      const registry = new FunctionRegistry();
      const result = await registry.execute('ghost_fn', {});
      expect(result).toContain('Unknown function');
      expect(result).toContain('ghost_fn');
    });

    it('passes args to the function execute method', async () => {
      const registry = new FunctionRegistry();
      let receivedArgs: unknown = null;
      registry.register('capturing_fn', {
        definition: {
          type: 'function',
          function: { name: 'capturing_fn', description: '', parameters: { type: 'object', properties: {} } },
        },
        execute: async (args) => {
          receivedArgs = args;
          return 'ok';
        },
      });
      await registry.execute('capturing_fn', { key: 'value' });
      expect(receivedArgs).toEqual({ key: 'value' });
    });
  });

  describe('register chaining', () => {
    it('supports fluent chaining of register calls', () => {
      const registry = new FunctionRegistry();
      registry
        .register('fn_a', makeFakeFunction('fn_a', 'a'))
        .register('fn_b', makeFakeFunction('fn_b', 'b'));
      expect(registry.getDefinitions()).toHaveLength(2);
    });
  });
});
