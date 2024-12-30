import { hello } from './index';

describe('@workspace/encrypted', () => {
  it('should return hello message', () => {
    expect(hello()).toBe('Hello from @workspace/encrypted');
  });
});
