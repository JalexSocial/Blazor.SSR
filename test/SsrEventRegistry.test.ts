import { expect, test, describe } from '@jest/globals';
import { SsrEventRegistry } from '../src/Services/SsrEventRegistry';

describe('SsrEventRegistry', () => {
  test('dispatches enhanced navigation events to registered listeners', () => {
    // Arrange
    const registry = new SsrEventRegistry();
    const receivedEventTypes: string[] = [];
    registry.addEventListener('enhancednavigationstart', event => receivedEventTypes.push(event.type));
    registry.addEventListener('enhancedload', event => receivedEventTypes.push(event.type));
    registry.addEventListener('enhancednavigationend', event => receivedEventTypes.push(event.type));

    // Act
    registry.dispatchEvent('enhancednavigationstart', {});
    registry.dispatchEvent('enhancedload', {});
    registry.dispatchEvent('enhancednavigationend', {});

    // Assert
    expect(receivedEventTypes).toEqual([
      'enhancednavigationstart',
      'enhancedload',
      'enhancednavigationend',
    ]);
  });

  test('does not dispatch removed enhanced navigation listeners', () => {
    // Arrange
    const registry = new SsrEventRegistry();
    let dispatchCount = 0;
    const listener = () => { dispatchCount += 1; };
    registry.addEventListener('enhancedload', listener);

    // Act
    registry.removeEventListener('enhancedload', listener);
    registry.dispatchEvent('enhancedload', {});

    // Assert
    expect(dispatchCount).toBe(0);
  });
});
