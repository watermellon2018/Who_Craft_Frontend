// Manual mock for axios. The real `axios` v1 ships as ESM and Jest's default
// transformer skips node_modules, which makes any module that imports
// `axios` (directly or transitively) crash at parse time with
// "Cannot use import statement outside a module".
//
// We replace the package with a minimal stub. Tests that need to assert
// request/response behaviour should mock the specific API module (e.g.
// `jest.mock('../api/characterApi')`) and not rely on this stub returning
// realistic data.

const noop = () => Promise.resolve({data: undefined, status: 200, headers: {}, config: {}, statusText: 'OK'});

const instance = {
  get: jest.fn(noop),
  post: jest.fn(noop),
  put: jest.fn(noop),
  patch: jest.fn(noop),
  delete: jest.fn(noop),
  request: jest.fn(noop),
  interceptors: {
    request: {use: jest.fn(), eject: jest.fn()},
    response: {use: jest.fn(), eject: jest.fn()},
  },
  defaults: {headers: {common: {}}},
};

const axiosMock: any = {
  create: jest.fn(() => instance),
  get: jest.fn(noop),
  post: jest.fn(noop),
  put: jest.fn(noop),
  patch: jest.fn(noop),
  delete: jest.fn(noop),
  request: jest.fn(noop),
  isAxiosError: jest.fn(() => false),
  interceptors: instance.interceptors,
  defaults: instance.defaults,
};

axiosMock.default = axiosMock;

module.exports = axiosMock;
export {};
