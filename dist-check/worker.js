var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/_internal/utils.mjs
// @__NO_SIDE_EFFECTS__
function createNotImplementedError(name) {
  return new Error(`[unenv] ${name} is not implemented yet!`);
}
__name(createNotImplementedError, "createNotImplementedError");
// @__NO_SIDE_EFFECTS__
function notImplemented(name) {
  const fn = /* @__PURE__ */ __name(() => {
    throw /* @__PURE__ */ createNotImplementedError(name);
  }, "fn");
  return Object.assign(fn, { __unenv__: true });
}
__name(notImplemented, "notImplemented");
// @__NO_SIDE_EFFECTS__
function notImplementedClass(name) {
  return class {
    __unenv__ = true;
    constructor() {
      throw new Error(`[unenv] ${name} is not implemented yet!`);
    }
  };
}
__name(notImplementedClass, "notImplementedClass");

// ../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/internal/perf_hooks/performance.mjs
var _timeOrigin = globalThis.performance?.timeOrigin ?? Date.now();
var _performanceNow = globalThis.performance?.now ? globalThis.performance.now.bind(globalThis.performance) : () => Date.now() - _timeOrigin;
var nodeTiming = {
  name: "node",
  entryType: "node",
  startTime: 0,
  duration: 0,
  nodeStart: 0,
  v8Start: 0,
  bootstrapComplete: 0,
  environment: 0,
  loopStart: 0,
  loopExit: 0,
  idleTime: 0,
  uvMetricsInfo: {
    loopCount: 0,
    events: 0,
    eventsWaiting: 0
  },
  detail: void 0,
  toJSON() {
    return this;
  }
};
var PerformanceEntry = class {
  static {
    __name(this, "PerformanceEntry");
  }
  __unenv__ = true;
  detail;
  entryType = "event";
  name;
  startTime;
  constructor(name, options) {
    this.name = name;
    this.startTime = options?.startTime || _performanceNow();
    this.detail = options?.detail;
  }
  get duration() {
    return _performanceNow() - this.startTime;
  }
  toJSON() {
    return {
      name: this.name,
      entryType: this.entryType,
      startTime: this.startTime,
      duration: this.duration,
      detail: this.detail
    };
  }
};
var PerformanceMark = class PerformanceMark2 extends PerformanceEntry {
  static {
    __name(this, "PerformanceMark");
  }
  entryType = "mark";
  constructor() {
    super(...arguments);
  }
  get duration() {
    return 0;
  }
};
var PerformanceMeasure = class extends PerformanceEntry {
  static {
    __name(this, "PerformanceMeasure");
  }
  entryType = "measure";
};
var PerformanceResourceTiming = class extends PerformanceEntry {
  static {
    __name(this, "PerformanceResourceTiming");
  }
  entryType = "resource";
  serverTiming = [];
  connectEnd = 0;
  connectStart = 0;
  decodedBodySize = 0;
  domainLookupEnd = 0;
  domainLookupStart = 0;
  encodedBodySize = 0;
  fetchStart = 0;
  initiatorType = "";
  name = "";
  nextHopProtocol = "";
  redirectEnd = 0;
  redirectStart = 0;
  requestStart = 0;
  responseEnd = 0;
  responseStart = 0;
  secureConnectionStart = 0;
  startTime = 0;
  transferSize = 0;
  workerStart = 0;
  responseStatus = 0;
};
var PerformanceObserverEntryList = class {
  static {
    __name(this, "PerformanceObserverEntryList");
  }
  __unenv__ = true;
  getEntries() {
    return [];
  }
  getEntriesByName(_name, _type) {
    return [];
  }
  getEntriesByType(type) {
    return [];
  }
};
var Performance = class {
  static {
    __name(this, "Performance");
  }
  __unenv__ = true;
  timeOrigin = _timeOrigin;
  eventCounts = /* @__PURE__ */ new Map();
  _entries = [];
  _resourceTimingBufferSize = 0;
  navigation = void 0;
  timing = void 0;
  timerify(_fn, _options) {
    throw createNotImplementedError("Performance.timerify");
  }
  get nodeTiming() {
    return nodeTiming;
  }
  eventLoopUtilization() {
    return {};
  }
  markResourceTiming() {
    return new PerformanceResourceTiming("");
  }
  onresourcetimingbufferfull = null;
  now() {
    if (this.timeOrigin === _timeOrigin) {
      return _performanceNow();
    }
    return Date.now() - this.timeOrigin;
  }
  clearMarks(markName) {
    this._entries = markName ? this._entries.filter((e) => e.name !== markName) : this._entries.filter((e) => e.entryType !== "mark");
  }
  clearMeasures(measureName) {
    this._entries = measureName ? this._entries.filter((e) => e.name !== measureName) : this._entries.filter((e) => e.entryType !== "measure");
  }
  clearResourceTimings() {
    this._entries = this._entries.filter((e) => e.entryType !== "resource" || e.entryType !== "navigation");
  }
  getEntries() {
    return this._entries;
  }
  getEntriesByName(name, type) {
    return this._entries.filter((e) => e.name === name && (!type || e.entryType === type));
  }
  getEntriesByType(type) {
    return this._entries.filter((e) => e.entryType === type);
  }
  mark(name, options) {
    const entry = new PerformanceMark(name, options);
    this._entries.push(entry);
    return entry;
  }
  measure(measureName, startOrMeasureOptions, endMark) {
    let start;
    let end;
    if (typeof startOrMeasureOptions === "string") {
      start = this.getEntriesByName(startOrMeasureOptions, "mark")[0]?.startTime;
      end = this.getEntriesByName(endMark, "mark")[0]?.startTime;
    } else {
      start = Number.parseFloat(startOrMeasureOptions?.start) || this.now();
      end = Number.parseFloat(startOrMeasureOptions?.end) || this.now();
    }
    const entry = new PerformanceMeasure(measureName, {
      startTime: start,
      detail: {
        start,
        end
      }
    });
    this._entries.push(entry);
    return entry;
  }
  setResourceTimingBufferSize(maxSize) {
    this._resourceTimingBufferSize = maxSize;
  }
  addEventListener(type, listener, options) {
    throw createNotImplementedError("Performance.addEventListener");
  }
  removeEventListener(type, listener, options) {
    throw createNotImplementedError("Performance.removeEventListener");
  }
  dispatchEvent(event) {
    throw createNotImplementedError("Performance.dispatchEvent");
  }
  toJSON() {
    return this;
  }
};
var PerformanceObserver = class {
  static {
    __name(this, "PerformanceObserver");
  }
  __unenv__ = true;
  static supportedEntryTypes = [];
  _callback = null;
  constructor(callback) {
    this._callback = callback;
  }
  takeRecords() {
    return [];
  }
  disconnect() {
    throw createNotImplementedError("PerformanceObserver.disconnect");
  }
  observe(options) {
    throw createNotImplementedError("PerformanceObserver.observe");
  }
  bind(fn) {
    return fn;
  }
  runInAsyncScope(fn, thisArg, ...args) {
    return fn.call(thisArg, ...args);
  }
  asyncId() {
    return 0;
  }
  triggerAsyncId() {
    return 0;
  }
  emitDestroy() {
    return this;
  }
};
var performance = globalThis.performance && "addEventListener" in globalThis.performance ? globalThis.performance : new Performance();

// ../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/@cloudflare/unenv-preset/dist/runtime/polyfill/performance.mjs
if (!("__unenv__" in performance)) {
  const proto = Performance.prototype;
  for (const key of Object.getOwnPropertyNames(proto)) {
    if (key !== "constructor" && !(key in performance)) {
      const desc = Object.getOwnPropertyDescriptor(proto, key);
      if (desc) {
        Object.defineProperty(performance, key, desc);
      }
    }
  }
}
globalThis.performance = performance;
globalThis.Performance = Performance;
globalThis.PerformanceEntry = PerformanceEntry;
globalThis.PerformanceMark = PerformanceMark;
globalThis.PerformanceMeasure = PerformanceMeasure;
globalThis.PerformanceObserver = PerformanceObserver;
globalThis.PerformanceObserverEntryList = PerformanceObserverEntryList;
globalThis.PerformanceResourceTiming = PerformanceResourceTiming;

// ../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/console.mjs
import { Writable } from "node:stream";

// ../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/mock/noop.mjs
var noop_default = Object.assign(() => {
}, { __unenv__: true });

// ../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/console.mjs
var _console = globalThis.console;
var _ignoreErrors = true;
var _stderr = new Writable();
var _stdout = new Writable();
var log = _console?.log ?? noop_default;
var info = _console?.info ?? log;
var trace = _console?.trace ?? info;
var debug = _console?.debug ?? log;
var table = _console?.table ?? log;
var error = _console?.error ?? log;
var warn = _console?.warn ?? error;
var createTask = _console?.createTask ?? /* @__PURE__ */ notImplemented("console.createTask");
var clear = _console?.clear ?? noop_default;
var count = _console?.count ?? noop_default;
var countReset = _console?.countReset ?? noop_default;
var dir = _console?.dir ?? noop_default;
var dirxml = _console?.dirxml ?? noop_default;
var group = _console?.group ?? noop_default;
var groupEnd = _console?.groupEnd ?? noop_default;
var groupCollapsed = _console?.groupCollapsed ?? noop_default;
var profile = _console?.profile ?? noop_default;
var profileEnd = _console?.profileEnd ?? noop_default;
var time = _console?.time ?? noop_default;
var timeEnd = _console?.timeEnd ?? noop_default;
var timeLog = _console?.timeLog ?? noop_default;
var timeStamp = _console?.timeStamp ?? noop_default;
var Console = _console?.Console ?? /* @__PURE__ */ notImplementedClass("console.Console");
var _times = /* @__PURE__ */ new Map();
var _stdoutErrorHandler = noop_default;
var _stderrErrorHandler = noop_default;

// ../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/@cloudflare/unenv-preset/dist/runtime/node/console.mjs
var workerdConsole = globalThis["console"];
var {
  assert,
  clear: clear2,
  // @ts-expect-error undocumented public API
  context,
  count: count2,
  countReset: countReset2,
  // @ts-expect-error undocumented public API
  createTask: createTask2,
  debug: debug2,
  dir: dir2,
  dirxml: dirxml2,
  error: error2,
  group: group2,
  groupCollapsed: groupCollapsed2,
  groupEnd: groupEnd2,
  info: info2,
  log: log2,
  profile: profile2,
  profileEnd: profileEnd2,
  table: table2,
  time: time2,
  timeEnd: timeEnd2,
  timeLog: timeLog2,
  timeStamp: timeStamp2,
  trace: trace2,
  warn: warn2
} = workerdConsole;
Object.assign(workerdConsole, {
  Console,
  _ignoreErrors,
  _stderr,
  _stderrErrorHandler,
  _stdout,
  _stdoutErrorHandler,
  _times
});
var console_default = workerdConsole;

// ../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-console
globalThis.console = console_default;

// ../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/internal/process/hrtime.mjs
var hrtime = /* @__PURE__ */ Object.assign(/* @__PURE__ */ __name(function hrtime2(startTime) {
  const now = Date.now();
  const seconds = Math.trunc(now / 1e3);
  const nanos = now % 1e3 * 1e6;
  if (startTime) {
    let diffSeconds = seconds - startTime[0];
    let diffNanos = nanos - startTime[0];
    if (diffNanos < 0) {
      diffSeconds = diffSeconds - 1;
      diffNanos = 1e9 + diffNanos;
    }
    return [diffSeconds, diffNanos];
  }
  return [seconds, nanos];
}, "hrtime"), { bigint: /* @__PURE__ */ __name(function bigint() {
  return BigInt(Date.now() * 1e6);
}, "bigint") });

// ../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/internal/process/process.mjs
import { EventEmitter } from "node:events";

// ../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/internal/tty/read-stream.mjs
var ReadStream = class {
  static {
    __name(this, "ReadStream");
  }
  fd;
  isRaw = false;
  isTTY = false;
  constructor(fd) {
    this.fd = fd;
  }
  setRawMode(mode) {
    this.isRaw = mode;
    return this;
  }
};

// ../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/internal/tty/write-stream.mjs
var WriteStream = class {
  static {
    __name(this, "WriteStream");
  }
  fd;
  columns = 80;
  rows = 24;
  isTTY = false;
  constructor(fd) {
    this.fd = fd;
  }
  clearLine(dir3, callback) {
    callback && callback();
    return false;
  }
  clearScreenDown(callback) {
    callback && callback();
    return false;
  }
  cursorTo(x, y, callback) {
    callback && typeof callback === "function" && callback();
    return false;
  }
  moveCursor(dx, dy, callback) {
    callback && callback();
    return false;
  }
  getColorDepth(env2) {
    return 1;
  }
  hasColors(count3, env2) {
    return false;
  }
  getWindowSize() {
    return [this.columns, this.rows];
  }
  write(str, encoding, cb) {
    if (str instanceof Uint8Array) {
      str = new TextDecoder().decode(str);
    }
    try {
      console.log(str);
    } catch {
    }
    cb && typeof cb === "function" && cb();
    return false;
  }
};

// ../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/internal/process/node-version.mjs
var NODE_VERSION = "22.14.0";

// ../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/internal/process/process.mjs
var Process = class _Process extends EventEmitter {
  static {
    __name(this, "Process");
  }
  env;
  hrtime;
  nextTick;
  constructor(impl) {
    super();
    this.env = impl.env;
    this.hrtime = impl.hrtime;
    this.nextTick = impl.nextTick;
    for (const prop of [...Object.getOwnPropertyNames(_Process.prototype), ...Object.getOwnPropertyNames(EventEmitter.prototype)]) {
      const value = this[prop];
      if (typeof value === "function") {
        this[prop] = value.bind(this);
      }
    }
  }
  // --- event emitter ---
  emitWarning(warning, type, code) {
    console.warn(`${code ? `[${code}] ` : ""}${type ? `${type}: ` : ""}${warning}`);
  }
  emit(...args) {
    return super.emit(...args);
  }
  listeners(eventName) {
    return super.listeners(eventName);
  }
  // --- stdio (lazy initializers) ---
  #stdin;
  #stdout;
  #stderr;
  get stdin() {
    return this.#stdin ??= new ReadStream(0);
  }
  get stdout() {
    return this.#stdout ??= new WriteStream(1);
  }
  get stderr() {
    return this.#stderr ??= new WriteStream(2);
  }
  // --- cwd ---
  #cwd = "/";
  chdir(cwd2) {
    this.#cwd = cwd2;
  }
  cwd() {
    return this.#cwd;
  }
  // --- dummy props and getters ---
  arch = "";
  platform = "";
  argv = [];
  argv0 = "";
  execArgv = [];
  execPath = "";
  title = "";
  pid = 200;
  ppid = 100;
  get version() {
    return `v${NODE_VERSION}`;
  }
  get versions() {
    return { node: NODE_VERSION };
  }
  get allowedNodeEnvironmentFlags() {
    return /* @__PURE__ */ new Set();
  }
  get sourceMapsEnabled() {
    return false;
  }
  get debugPort() {
    return 0;
  }
  get throwDeprecation() {
    return false;
  }
  get traceDeprecation() {
    return false;
  }
  get features() {
    return {};
  }
  get release() {
    return {};
  }
  get connected() {
    return false;
  }
  get config() {
    return {};
  }
  get moduleLoadList() {
    return [];
  }
  constrainedMemory() {
    return 0;
  }
  availableMemory() {
    return 0;
  }
  uptime() {
    return 0;
  }
  resourceUsage() {
    return {};
  }
  // --- noop methods ---
  ref() {
  }
  unref() {
  }
  // --- unimplemented methods ---
  umask() {
    throw createNotImplementedError("process.umask");
  }
  getBuiltinModule() {
    return void 0;
  }
  getActiveResourcesInfo() {
    throw createNotImplementedError("process.getActiveResourcesInfo");
  }
  exit() {
    throw createNotImplementedError("process.exit");
  }
  reallyExit() {
    throw createNotImplementedError("process.reallyExit");
  }
  kill() {
    throw createNotImplementedError("process.kill");
  }
  abort() {
    throw createNotImplementedError("process.abort");
  }
  dlopen() {
    throw createNotImplementedError("process.dlopen");
  }
  setSourceMapsEnabled() {
    throw createNotImplementedError("process.setSourceMapsEnabled");
  }
  loadEnvFile() {
    throw createNotImplementedError("process.loadEnvFile");
  }
  disconnect() {
    throw createNotImplementedError("process.disconnect");
  }
  cpuUsage() {
    throw createNotImplementedError("process.cpuUsage");
  }
  setUncaughtExceptionCaptureCallback() {
    throw createNotImplementedError("process.setUncaughtExceptionCaptureCallback");
  }
  hasUncaughtExceptionCaptureCallback() {
    throw createNotImplementedError("process.hasUncaughtExceptionCaptureCallback");
  }
  initgroups() {
    throw createNotImplementedError("process.initgroups");
  }
  openStdin() {
    throw createNotImplementedError("process.openStdin");
  }
  assert() {
    throw createNotImplementedError("process.assert");
  }
  binding() {
    throw createNotImplementedError("process.binding");
  }
  // --- attached interfaces ---
  permission = { has: /* @__PURE__ */ notImplemented("process.permission.has") };
  report = {
    directory: "",
    filename: "",
    signal: "SIGUSR2",
    compact: false,
    reportOnFatalError: false,
    reportOnSignal: false,
    reportOnUncaughtException: false,
    getReport: /* @__PURE__ */ notImplemented("process.report.getReport"),
    writeReport: /* @__PURE__ */ notImplemented("process.report.writeReport")
  };
  finalization = {
    register: /* @__PURE__ */ notImplemented("process.finalization.register"),
    unregister: /* @__PURE__ */ notImplemented("process.finalization.unregister"),
    registerBeforeExit: /* @__PURE__ */ notImplemented("process.finalization.registerBeforeExit")
  };
  memoryUsage = Object.assign(() => ({
    arrayBuffers: 0,
    rss: 0,
    external: 0,
    heapTotal: 0,
    heapUsed: 0
  }), { rss: /* @__PURE__ */ __name(() => 0, "rss") });
  // --- undefined props ---
  mainModule = void 0;
  domain = void 0;
  // optional
  send = void 0;
  exitCode = void 0;
  channel = void 0;
  getegid = void 0;
  geteuid = void 0;
  getgid = void 0;
  getgroups = void 0;
  getuid = void 0;
  setegid = void 0;
  seteuid = void 0;
  setgid = void 0;
  setgroups = void 0;
  setuid = void 0;
  // internals
  _events = void 0;
  _eventsCount = void 0;
  _exiting = void 0;
  _maxListeners = void 0;
  _debugEnd = void 0;
  _debugProcess = void 0;
  _fatalException = void 0;
  _getActiveHandles = void 0;
  _getActiveRequests = void 0;
  _kill = void 0;
  _preload_modules = void 0;
  _rawDebug = void 0;
  _startProfilerIdleNotifier = void 0;
  _stopProfilerIdleNotifier = void 0;
  _tickCallback = void 0;
  _disconnect = void 0;
  _handleQueue = void 0;
  _pendingMessage = void 0;
  _channel = void 0;
  _send = void 0;
  _linkedBinding = void 0;
};

// ../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/@cloudflare/unenv-preset/dist/runtime/node/process.mjs
var globalProcess = globalThis["process"];
var getBuiltinModule = globalProcess.getBuiltinModule;
var workerdProcess = getBuiltinModule("node:process");
var unenvProcess = new Process({
  env: globalProcess.env,
  hrtime,
  // `nextTick` is available from workerd process v1
  nextTick: workerdProcess.nextTick
});
var { exit, features, platform } = workerdProcess;
var {
  _channel,
  _debugEnd,
  _debugProcess,
  _disconnect,
  _events,
  _eventsCount,
  _exiting,
  _fatalException,
  _getActiveHandles,
  _getActiveRequests,
  _handleQueue,
  _kill,
  _linkedBinding,
  _maxListeners,
  _pendingMessage,
  _preload_modules,
  _rawDebug,
  _send,
  _startProfilerIdleNotifier,
  _stopProfilerIdleNotifier,
  _tickCallback,
  abort,
  addListener,
  allowedNodeEnvironmentFlags,
  arch,
  argv,
  argv0,
  assert: assert2,
  availableMemory,
  binding,
  channel,
  chdir,
  config,
  connected,
  constrainedMemory,
  cpuUsage,
  cwd,
  debugPort,
  disconnect,
  dlopen,
  domain,
  emit,
  emitWarning,
  env,
  eventNames,
  execArgv,
  execPath,
  exitCode,
  finalization,
  getActiveResourcesInfo,
  getegid,
  geteuid,
  getgid,
  getgroups,
  getMaxListeners,
  getuid,
  hasUncaughtExceptionCaptureCallback,
  hrtime: hrtime3,
  initgroups,
  kill,
  listenerCount,
  listeners,
  loadEnvFile,
  mainModule,
  memoryUsage,
  moduleLoadList,
  nextTick,
  off,
  on,
  once,
  openStdin,
  permission,
  pid,
  ppid,
  prependListener,
  prependOnceListener,
  rawListeners,
  reallyExit,
  ref,
  release,
  removeAllListeners,
  removeListener,
  report,
  resourceUsage,
  send,
  setegid,
  seteuid,
  setgid,
  setgroups,
  setMaxListeners,
  setSourceMapsEnabled,
  setuid,
  setUncaughtExceptionCaptureCallback,
  sourceMapsEnabled,
  stderr,
  stdin,
  stdout,
  throwDeprecation,
  title,
  traceDeprecation,
  umask,
  unref,
  uptime,
  version,
  versions
} = unenvProcess;
var _process = {
  abort,
  addListener,
  allowedNodeEnvironmentFlags,
  hasUncaughtExceptionCaptureCallback,
  setUncaughtExceptionCaptureCallback,
  loadEnvFile,
  sourceMapsEnabled,
  arch,
  argv,
  argv0,
  chdir,
  config,
  connected,
  constrainedMemory,
  availableMemory,
  cpuUsage,
  cwd,
  debugPort,
  dlopen,
  disconnect,
  emit,
  emitWarning,
  env,
  eventNames,
  execArgv,
  execPath,
  exit,
  finalization,
  features,
  getBuiltinModule,
  getActiveResourcesInfo,
  getMaxListeners,
  hrtime: hrtime3,
  kill,
  listeners,
  listenerCount,
  memoryUsage,
  nextTick,
  on,
  off,
  once,
  pid,
  platform,
  ppid,
  prependListener,
  prependOnceListener,
  rawListeners,
  release,
  removeAllListeners,
  removeListener,
  report,
  resourceUsage,
  setMaxListeners,
  setSourceMapsEnabled,
  stderr,
  stdin,
  stdout,
  title,
  throwDeprecation,
  traceDeprecation,
  umask,
  uptime,
  version,
  versions,
  // @ts-expect-error old API
  domain,
  initgroups,
  moduleLoadList,
  reallyExit,
  openStdin,
  assert: assert2,
  binding,
  send,
  exitCode,
  channel,
  getegid,
  geteuid,
  getgid,
  getgroups,
  getuid,
  setegid,
  seteuid,
  setgid,
  setgroups,
  setuid,
  permission,
  mainModule,
  _events,
  _eventsCount,
  _exiting,
  _maxListeners,
  _debugEnd,
  _debugProcess,
  _fatalException,
  _getActiveHandles,
  _getActiveRequests,
  _kill,
  _preload_modules,
  _rawDebug,
  _startProfilerIdleNotifier,
  _stopProfilerIdleNotifier,
  _tickCallback,
  _disconnect,
  _handleQueue,
  _pendingMessage,
  _channel,
  _send,
  _linkedBinding
};
var process_default = _process;

// ../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-process
globalThis.process = process_default;

// workers/dealers/dealers.config.js
var DEALERS = {
  // ─────────────────────────────────────────────────────────────
  // EXAMPLE DEALER 1 — FindnDrive (default / fallback)
  // ─────────────────────────────────────────────────────────────
  "findndrive": {
    name: "FindnDrive",
    branchCode: "SRT001EM",
    // ← Edith BranchCode
    financeType: "vehicle",
    allowedDomains: [
      "findndrive.co.za",
      "seritifinancedev.findndrive.co.za",
      "seritifinance.findndrive.co.za",
      "www.findndrive.co.za",
      "localhost",
      "findanddrivesupport-e-fficient-ui.still-fire-1c3d.workers.dev"
    ],
    theme: {
      primary: "#6C3FC5",
      primaryLight: "#8B5CF6",
      primaryDark: "#4C1D95",
      gradient: "linear-gradient(135deg, #6C3FC5 0%, #C026D3 100%)",
      fontFamily: "'Inter', sans-serif",
      borderRadius: "12px",
      logoUrl: "/logos/findndrive.svg"
    },
    features: {
      showDeposit: true,
      showCurrentFinance: true,
      vehicleQueryParams: true
      // accepts ?make=&model=&mm= in embed URL
    }
  },
  // ─────────────────────────────────────────────────────────────
  // EXAMPLE DEALER 2 — Car Dealer XYZ
  // ─────────────────────────────────────────────────────────────
  "dealer-xyz": {
    name: "Car Dealer XYZ",
    branchCode: "XYZ002",
    financeType: "vehicle",
    allowedDomains: [
      "dealerxyz.co.za",
      "www.dealerxyz.co.za"
    ],
    theme: {
      primary: "#E63946",
      primaryLight: "#FF6B6B",
      primaryDark: "#9B0000",
      gradient: "linear-gradient(135deg, #E63946 0%, #FF6B6B 100%)",
      fontFamily: "'Inter', sans-serif",
      borderRadius: "8px",
      logoUrl: "/logos/dealer-xyz.svg"
    },
    features: {
      showDeposit: true,
      showCurrentFinance: false,
      vehicleQueryParams: true
    }
  }
  // ─────────────────────────────────────────────────────────────
  // ADD MORE DEALERS BELOW — copy a block, change the values
  // ─────────────────────────────────────────────────────────────
};
function getDealerConfig(dealerKey, referringDomain) {
  if (dealerKey && DEALERS[dealerKey]) {
    return { key: dealerKey, ...DEALERS[dealerKey] };
  }
  if (referringDomain) {
    const hostname = referringDomain.replace(/^https?:\/\//, "").split("/")[0];
    for (const [key, config2] of Object.entries(DEALERS)) {
      if (config2.allowedDomains.some((d) => hostname === d || hostname.endsWith(`.${d}`))) {
        return { key, ...config2 };
      }
    }
  }
  const [firstKey, firstConfig] = Object.entries(DEALERS)[0];
  return { key: firstKey, ...firstConfig };
}
__name(getDealerConfig, "getDealerConfig");
function isOriginAllowed(origin) {
  if (!origin) return false;
  const hostname = origin.replace(/^https?:\/\//, "").split("/")[0].split(":")[0];
  for (const config2 of Object.values(DEALERS)) {
    if (config2.allowedDomains.includes(hostname)) return true;
    if (config2.allowedDomains.some((d) => hostname.endsWith(`.${d}`))) return true;
  }
  return false;
}
__name(isOriginAllowed, "isOriginAllowed");

// workers/services/seritiAuth.js
var SERITI_BASE = "https://seritiapi.findndrive.co.za";
function tokenCacheKey(dealerKey) {
  return dealerKey ? `seriti_token_${dealerKey}` : "seriti_bearer_token";
}
__name(tokenCacheKey, "tokenCacheKey");
async function getDealerCredentials(env2, dealerKey) {
  if (!dealerKey || !env2.SERITI_CACHE) {
    return { apiKey: env2.SERITI_API_KEY, apiSecret: env2.SERITI_API_SECRET };
  }
  const [apiKey, apiSecret] = await Promise.all([
    env2.SERITI_CACHE.get(`SERITI_KEY_${dealerKey}`),
    env2.SERITI_CACHE.get(`SERITI_SECRET_${dealerKey}`)
  ]);
  return {
    apiKey: apiKey || env2.SERITI_API_KEY,
    apiSecret: apiSecret || env2.SERITI_API_SECRET
  };
}
__name(getDealerCredentials, "getDealerCredentials");
async function getSeritiToken(env2, dealerKey) {
  const cacheKey = tokenCacheKey(dealerKey);
  if (env2.SERITI_CACHE) {
    const cached = await env2.SERITI_CACHE.get(cacheKey, "json");
    if (cached && cached.token && cached.expiresAt > Date.now()) {
      return cached.token;
    }
  }
  const { apiKey, apiSecret } = await getDealerCredentials(env2, dealerKey);
  if (!apiKey || !apiSecret) {
    throw new Error(`Seriti credentials not found for dealer: ${dealerKey || "global"}`);
  }
  const response = await fetch(`${SERITI_BASE}/api/Authentication/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ApiKeyId: apiKey, apiSecret })
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Seriti auth failed (${response.status}): ${text}`);
  }
  const data = await response.json();
  const token = data.token || data.access_token || data.accessToken;
  if (!token) throw new Error("Seriti auth: no token in response");
  if (env2.SERITI_CACHE) {
    const expiresAt = Date.now() + 58 * 60 * 1e3;
    await env2.SERITI_CACHE.put(cacheKey, JSON.stringify({ token, expiresAt }), {
      expirationTtl: 3480
    });
  }
  return token;
}
__name(getSeritiToken, "getSeritiToken");
async function seritiRequest(path, options = {}, env2, dealerKey) {
  const token = await getSeritiToken(env2, dealerKey);
  const response = await fetch(`${SERITI_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      ...options.headers || {}
    }
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    throw new Error(`Seriti API error (${response.status}): ${JSON.stringify(data)}`);
  }
  return data;
}
__name(seritiRequest, "seritiRequest");

// workers/routes/preQual.js
async function handlePreQual(request, ctx, jsonResponse2) {
  const { env: env2, dealerConfig, origin } = ctx;
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse2({ error: "Invalid JSON body" }, 400, origin, env2);
  }
  const required = ["firstName", "lastName", "netIncome", "mobileNumber"];
  for (const field of required) {
    if (!body[field] && body[field] !== 0) {
      return jsonResponse2({ error: `Missing required field: ${field}` }, 400, origin, env2);
    }
  }
  if (!isValidSAMobile(body.mobileNumber)) {
    return jsonResponse2({
      error: "Invalid mobile number. Use a valid 10-digit SA number (e.g. 0821234567)."
    }, 400, origin, env2);
  }
  const seritiPayload = {
    firstName: body.firstName,
    lastName: body.lastName,
    netIncome: Number(body.netIncome),
    mobileNumber: formatMobile(body.mobileNumber),
    hasDeposit: body.hasDeposit || false,
    hasExistingFinance: body.hasExistingFinance || false,
    branchCode: dealerConfig.branchCode,
    ...body.vehicleMake ? { vehicleMake: body.vehicleMake } : {},
    ...body.vehicleModel ? { vehicleModel: body.vehicleModel } : {},
    ...body.vehicleMm ? { vehicleMm: body.vehicleMm } : {}
  };
  let result;
  try {
    result = await seritiRequest("/api/Financing/Pre-Qualification", {
      method: "POST",
      body: JSON.stringify(seritiPayload)
    }, env2, dealerConfig?.key);
  } catch (err) {
    return jsonResponse2({ error: "Seriti API error", details: err.message }, 502, origin, env2);
  }
  return jsonResponse2({
    totalAmount: result.totalAmount,
    monthlyAmount: result.monthlyAmount,
    applicantId: result.applicantId
  }, 200, origin, env2);
}
__name(handlePreQual, "handlePreQual");
function isValidSAMobile(number) {
  if (!number) return false;
  const cleaned = number.replace(/\s|-/g, "");
  if (/^01/.test(cleaned)) return false;
  if (!/^0[6-8]\d{8}$/.test(cleaned)) return false;
  if (/^(\d)\1+$/.test(cleaned)) return false;
  return true;
}
__name(isValidSAMobile, "isValidSAMobile");
function formatMobile(number) {
  const cleaned = number.replace(/\s|-/g, "");
  if (cleaned.startsWith("+27")) return cleaned;
  if (cleaned.startsWith("27")) return "+" + cleaned;
  if (cleaned.startsWith("0")) return "+27" + cleaned.slice(1);
  return "+27" + cleaned;
}
__name(formatMobile, "formatMobile");

// workers/routes/prediction.js
async function handlePrediction(request, ctx, jsonResponse2) {
  const { env: env2, dealerConfig, origin } = ctx;
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse2({ error: "Invalid JSON body" }, 400, origin, env2);
  }
  const { applicantId, grossIncome, idNumber, hasSAID, hasNoSAID, livingExpenses } = body;
  if (!applicantId) {
    return jsonResponse2({ error: "Missing applicantId" }, 400, origin, env2);
  }
  const noSAID = hasNoSAID || !hasSAID;
  if (!noSAID) {
    const idError = validateSAID(idNumber);
    if (idError) return jsonResponse2({ error: idError }, 400, origin, env2);
  }
  const seritiPayload = {
    applicantId,
    grossIncome: Number(grossIncome) || 0,
    netIncome: Number(body.netIncome) || 0,
    emailAddress: body.email || "",
    ...!noSAID && idNumber ? { idNumber } : {}
  };
  let result;
  try {
    result = await seritiRequest("/api/Financing/Prediction", {
      method: "POST",
      body: JSON.stringify(seritiPayload)
    }, env2, dealerConfig?.key);
  } catch (err) {
    return jsonResponse2({ error: "Seriti API error", details: err.message }, 502, origin, env2);
  }
  const predictionMap = {
    Low: { label: "In progress", headline: "Let's move forward with your application!", body: "We'll contact you to guide you through the next steps and explore the best options together." },
    Medium: { label: "Good news", headline: "You have a good chance of qualifying!", body: "Your profile looks promising. Complete your application and we'll be in touch shortly." },
    High: { label: "Great news", headline: "You're likely to qualify!", body: "Your profile looks great. Submit your application and we'll help you get into your next car." }
  };
  const predResponse = result.predictionResponse || {};
  const predNum = predResponse.prediction ?? -1;
  const predKey = predNum === 2 ? "High" : predNum === 1 ? "Medium" : "Low";
  return jsonResponse2({
    prediction: predictionMap[predKey] || predictionMap.Low,
    reason: predResponse.reason,
    estimatedApprovalAmount: predResponse.estimatedApprovalAmount,
    monthlyInstalment: predResponse.estimatedFinanceSpend
  }, 200, origin, env2);
}
__name(handlePrediction, "handlePrediction");
function validateSAID(id) {
  if (!id || id.length !== 13 || !/^\d{13}$/.test(id)) {
    return "ID number must be exactly 13 digits.";
  }
  if (/^(\d)\1+$/.test(id)) {
    return "ID number appears to be invalid (all digits the same).";
  }
  if (!validDate(id)) {
    return "ID number contains an invalid date of birth.";
  }
  if (!luhnCheck(id)) {
    return "ID number is not valid. Please check it matches your ID document exactly.";
  }
  return null;
}
__name(validateSAID, "validateSAID");
function validDate(id) {
  const yy = parseInt(id.substring(0, 2));
  const mm = parseInt(id.substring(2, 4));
  const dd = parseInt(id.substring(4, 6));
  const fullYear = yy <= (/* @__PURE__ */ new Date()).getFullYear() % 100 ? 2e3 + yy : 1900 + yy;
  const date = new Date(fullYear, mm - 1, dd);
  return date.getFullYear() === fullYear && date.getMonth() === mm - 1 && date.getDate() === dd;
}
__name(validDate, "validDate");
function luhnCheck(id) {
  if (!/^\d{13}$/.test(id)) return false;
  let sumOdd = 0;
  for (let i = 0; i < 12; i += 2) sumOdd += parseInt(id[i]);
  let evenDigits = "";
  for (let i = 1; i < 12; i += 2) evenDigits += id[i];
  let doubled = (parseInt(evenDigits) * 2).toString();
  let sumEven = doubled.split("").reduce((a, b) => a + parseInt(b), 0);
  const total = sumOdd + sumEven;
  const checkDigit = (10 - total % 10) % 10;
  return checkDigit === parseInt(id[12]);
}
__name(luhnCheck, "luhnCheck");

// workers/routes/getApplicant.js
async function handleGetApplicant(request, ctx, jsonResponse2) {
  const { env: env2, origin, dealerConfig } = ctx;
  const url = new URL(request.url);
  const applicantId = url.searchParams.get("applicantId");
  if (!applicantId) {
    return jsonResponse2({ error: "Missing applicantId" }, 400, origin, env2);
  }
  let result;
  try {
    result = await seritiRequest(
      `/api/Financing/GetApplicantById?id=${encodeURIComponent(applicantId)}`,
      { method: "GET" },
      env2,
      dealerConfig?.key
    );
  } catch (err) {
    return jsonResponse2({ error: "Seriti API error", details: err.message }, 502, origin, env2);
  }
  const applicant = result.response?.applicant || {};
  const address = applicant.applicantAddress || {};
  const employment = applicant.applicantEmploymentHistory || {};
  const finance = applicant.applicantFinance || {};
  return jsonResponse2({
    // Personal
    title: applicant.title,
    firstName: applicant.firstName,
    lastName: applicant.lastName,
    mobileNumber: applicant.mobileNumber,
    emailAddress: applicant.emailAddress,
    idNumber: applicant.idNumber,
    gender: applicant.gender,
    dateOfBirth: applicant.dateOfBirth,
    maritalStatus: applicant.maritalStatus,
    // Address
    address1: address.line1,
    suburb: address.township,
    township: address.township,
    city: address.city,
    province: address.province,
    postCode: address.postalCode,
    residentialStatus: address.residentialStatus,
    // Employment
    employmentType: employment.employmentType,
    employerName: applicant.latestCompanyName,
    industry: employment.industry,
    occupation: employment.occupation,
    occupationLevel: employment.level,
    currentEmploymentStartDate: employment.employmentDate,
    salaryDay: employment.remunerationDate,
    // Financials
    grossIncome: finance.grossIncome,
    netIncome: finance.netIncome,
    bureauExpenses: finance.bureauExpenses,
    // Next of kin
    nokFirst: applicant.nextOfKinFirstName,
    nokLast: applicant.nextOfKinLastName,
    nokContact: applicant.nextOfKinContactNumber
  }, 200, origin, env2);
}
__name(handleGetApplicant, "handleGetApplicant");

// workers/utils/edithErrors.js
var STATUS_CODES = {
  100: { label: "Success", severity: "success" },
  200: { label: "Success (some fields ignored)", severity: "warning" },
  300: { label: "Data failure", severity: "error" },
  400: { label: "Authentication failure", severity: "error" },
  410: { label: "Authorisation failure", severity: "error" },
  420: { label: "Not authorised to view", severity: "error" },
  500: { label: "System failure", severity: "error" }
};
var SYSTEM_MESSAGES = {
  400: {
    title: "We could not verify your application",
    message: "There was a problem connecting to our finance system. This is not caused by your details.",
    action: "Please contact the dealership and quote error code 400. They will be able to resubmit your application.",
    severity: "error",
    internal: "CompanyCode or CompanyPassword invalid. Check Worker secrets."
  },
  410: {
    title: "Access not permitted",
    message: "This dealership is not currently set up to submit applications through this system.",
    action: "Please speak to a member of staff at the dealership to complete your application in person.",
    severity: "error",
    internal: "Source system does not have access to this web method."
  },
  420: {
    title: "Application not found",
    message: "We were unable to retrieve your application. It may have already been submitted.",
    action: "Please contact the dealership with your reference number to check the status of your application.",
    severity: "error",
    internal: "Not authorised to view this policy. Check CompanyCode access."
  },
  500: {
    title: "System temporarily unavailable",
    message: "The finance system is currently unavailable. This is a temporary issue.",
    action: "Please try again in a few minutes. If the problem continues, contact the dealership.",
    severity: "error",
    internal: "Edith system failure."
  }
};
var FIELD_ERRORS = {
  CompanyCode: { title: "Dealer system error", message: "Could not connect using dealership credentials.", severity: "error", field: null },
  CompanyPassword: { title: "Dealer system error", message: "Could not authenticate with finance system.", severity: "error", field: null },
  BranchCode: { title: "Branch not found", message: "This dealership branch is not registered.", severity: "error", field: null },
  FIUserName: { title: "Finance manager not found", message: "Could not assign a finance manager.", severity: "error", field: null },
  SalesReferenceNumber: { title: "Application already exists", message: "A reference with this number has already been submitted.", severity: "error", field: null },
  LastName: { title: "Surname missing", message: "Your surname is required to submit your application.", severity: "error", field: "lastName" },
  IDNumber: { title: "ID number invalid", message: "The ID number does not appear to be valid, or does not match your date of birth and gender.", severity: "error", field: "idNumber" },
  BirthDate: { title: "Date of birth not saved", message: "Your date of birth could not be confirmed from your ID number.", severity: "warning", field: "birthDate" },
  Gender: { title: "Gender not saved", message: "Your gender could not be confirmed from your ID number.", severity: "warning", field: "gender" },
  Title: { title: "Title not recognised", message: "Please select from: Mr, Mrs, Miss, Ms, Dr, Prof, Adv, Hon, Rev.", severity: "warning", field: "title" },
  MobileNumber: { title: "Mobile number invalid", message: "Please enter your mobile number with 10 digits starting with 0 (e.g. 0821234567).", severity: "warning", field: "mobileNumber" },
  WorkTelephoneCode: { title: "Work telephone code invalid", message: "Enter your work area code with 3-4 digits starting with 0 (e.g. 011).", severity: "warning", field: "workTelCode" },
  HomeTelephoneNumber: { title: "Home number invalid", message: "Please enter only your 7-digit home number without the area code.", severity: "warning", field: "homeTelNumber" }
};
function parseEdithErrors(errors = []) {
  return errors.map((err) => {
    const mapped = FIELD_ERRORS[err.FieldName];
    const statusInfo = STATUS_CODES[err.StatusCode] || { severity: "error" };
    return {
      field: mapped?.field || err.FieldName,
      title: mapped?.title || `Error: ${err.FieldName}`,
      message: mapped?.message || err.ErrorMessage || "An unexpected error occurred.",
      action: mapped?.action || "Please review your details and try again.",
      severity: mapped?.severity || statusInfo.severity,
      internal: mapped?.internal || null
    };
  });
}
__name(parseEdithErrors, "parseEdithErrors");

// workers/routes/createPolicy.js
var EDITH_WSDL_DEFAULT = "https://www.seritisolutions.co.za/demows/PolicyServicesV300.asmx";
async function handleCreatePolicy(request, ctx, jsonResponse2) {
  const { env: env2, dealerConfig, origin } = ctx;
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse2({ error: "Invalid JSON body" }, 400, origin, env2);
  }
  const salesRef = generateSalesRef(dealerConfig.branchCode);
  console.error("EDITH_PAYLOAD: " + JSON.stringify(body));
  const xml = buildEdithXML(body, env2, dealerConfig, salesRef);
  console.error("EDITH_XML: " + xml);
  console.log(JSON.stringify({
    level: "info",
    type: "edith_create_policy_request",
    salesRef,
    dealerKey: dealerConfig.key,
    branchCode: dealerConfig.branchCode,
    payload: body,
    xml,
    ts: (/* @__PURE__ */ new Date()).toISOString()
  }));
  let edithResponse;
  try {
    const res = await fetch(EDITH_WSDL_DEFAULT, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": "http://ws.edith.co.za/EdithServices/PolicyServicesV300/CreatePolicy"
      },
      body: xml
    });
    const text = await res.text();
    console.log(JSON.stringify({
      level: "info",
      type: "edith_create_policy_response",
      salesRef,
      status: res.status,
      body: text,
      ts: (/* @__PURE__ */ new Date()).toISOString()
    }));
    console.error("EDITH_RAW_RESPONSE: " + text);
    edithResponse = parseEdithXMLResponse(text);
    console.error("EDITH_PARSED: " + JSON.stringify(edithResponse));
  } catch (err) {
    logError("edith_network_error", err, env2, { salesRef, dealerKey: dealerConfig.key });
    return jsonResponse2({
      error: "Could not connect to the finance system. Please try again.",
      code: 500
    }, 502, origin, env2);
  }
  const sysCode = edithResponse.statusCode;
  if (SYSTEM_MESSAGES[sysCode]) {
    const msg = SYSTEM_MESSAGES[sysCode];
    logError("edith_system_error", { code: sysCode, internal: msg.internal }, env2, { salesRef });
    return jsonResponse2({
      error: msg.title,
      message: msg.message,
      action: msg.action,
      code: sysCode
    }, 422, origin, env2);
  }
  if (edithResponse.errors && edithResponse.errors.length > 0) {
    const parsedErrors = parseEdithErrors(edithResponse.errors);
    const fatal = parsedErrors.filter((e) => e.severity === "error");
    const warnings = parsedErrors.filter((e) => e.severity === "warning");
    if (fatal.length > 0) {
      logError("edith_field_errors", fatal, env2, { salesRef });
      return jsonResponse2({
        success: false,
        errors: fatal,
        warnings,
        code: 300
      }, 422, origin, env2);
    }
    logWarning("edith_field_warnings", warnings, env2, { salesRef });
    return jsonResponse2({
      success: true,
      policyNumber: edithResponse.policyNumber,
      warnings,
      code: 200
    }, 200, origin, env2);
  }
  return jsonResponse2({
    success: true,
    policyNumber: edithResponse.policyNumber,
    salesRef,
    code: 100
  }, 200, origin, env2);
}
__name(handleCreatePolicy, "handleCreatePolicy");
function buildEdithXML(data, env2, dealer, salesRef) {
  const d = data;
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://ws.edith.co.za/EdithServices/PolicyServicesV300">
  <soap:Body>
    <tem:CreatePolicy>
      <tem:Credentials>
        <tem:CompanyCode>${env2.EDITH_COMPANY_CODE}</tem:CompanyCode>
        <tem:CompanyPassword>${env2.EDITH_COMPANY_PASS}</tem:CompanyPassword>
      </tem:Credentials>
      <tem:Policy>
        <tem:BranchCode>${dealer.branchCode}</tem:BranchCode>
        <tem:SalesReferenceNumber>${salesRef}</tem:SalesReferenceNumber>
        <tem:TransactionType>VEHICLE SALE</tem:TransactionType>
        <tem:Category>PRIVATE</tem:Category>
        ${d.vehicleMake ? `<tem:Manufacturer>${esc(d.vehicleMake)}</tem:Manufacturer>` : ""}
        ${d.vehicleModel ? `<tem:Model>${esc(d.vehicleModel)}</tem:Model>` : ""}
        ${d.vehicleMm ? `<tem:VehicleCode>${esc(d.vehicleMm)}</tem:VehicleCode>` : ""}
        ${d.vehicleMake || d.vehicleModel ? `<tem:VehicleDescription>${esc([d.vehicleMake, d.vehicleModel].filter(Boolean).join(" "))}</tem:VehicleDescription>` : ""}
        ${d.estimatedApprovalAmount ? `<tem:RetailPrice>${d.estimatedApprovalAmount}</tem:RetailPrice>` : ""}
        <tem:NewUsed>USED</tem:NewUsed>
       <tem:Client>
          ${d.title ? `<tem:Title>${esc(d.title.toUpperCase())}</tem:Title>` : ""}
          ${d.firstName ? `<tem:FirstName>${esc(d.firstName)}</tem:FirstName>` : ""}
          <tem:LastName>${esc(d.lastName)}</tem:LastName>
          ${d.mobileNumber ? `<tem:MobileNumber>${d.mobileNumber}</tem:MobileNumber>` : ""}
          ${d.emailAddress ? `<tem:EmailAddress>${esc(d.emailAddress)}</tem:EmailAddress>` : ""}
          ${d.idNumber ? `<tem:IDType>${esc(d.idType || "RSA ID")}</tem:IDType><tem:IDNumber>${d.idNumber}</tem:IDNumber>` : "<tem:IDType>FOREIGN NATIONAL</tem:IDType>"}
          ${d.gender ? `<tem:Gender>${esc(d.gender.toUpperCase())}</tem:Gender>` : ""}
          ${d.maritalStatus ? `<tem:MaritalStatus>${esc(d.maritalStatus)}</tem:MaritalStatus>` : ""}
          ${d.address1 ? `
          <tem:PhysicalAddress>
            <tem:Address1>${esc(d.address1)}</tem:Address1>
            ${d.suburb ? `<tem:Suburb>${esc(d.suburb)}</tem:Suburb>` : ""}
            ${d.city ? `<tem:City>${esc(d.city)}</tem:City>` : ""}
            ${d.postCode ? `<tem:PostCode>${esc(d.postCode)}</tem:PostCode>` : ""}
            <tem:Country>SOUTH AFRICA</tem:Country>
          </tem:PhysicalAddress>
          ${d.residentialStatus ? `<tem:ResidentialStatus>${esc(d.residentialStatus)}</tem:ResidentialStatus>` : ""}
          ${d.physicalAddressDate ? `<tem:PhysicalAddressDate>${esc(d.physicalAddressDate)}</tem:PhysicalAddressDate>` : ""}` : ""}
          ${d.nextOfKinFirstName ? `
          <tem:Relative>
            <tem:RelativeRelation>DISTANT</tem:RelativeRelation>
              <tem:RelativeFirstName>${esc(d.nextOfKinFirstName)}</tem:RelativeFirstName>
              <tem:RelativeLastName>${esc(d.nextOfKinLastName || "")}</tem:RelativeLastName>
              <tem:RelativeMobileNumber>${d.nextOfKinMobile || ""}</tem:RelativeMobileNumber>
          </tem:Relative>` : ""}
          ${d.employmentType ? `<tem:EmploymentType>${esc(d.employmentType)}</tem:EmploymentType>` : ""}
          ${d.employerName ? `<tem:EmployerName>${esc(d.employerName)}</tem:EmployerName>` : ""}
          ${d.occupation ? `<tem:Occupation>${esc(d.occupation)}</tem:Occupation>` : ""}
          ${d.occupationLevel ? `<tem:OccupationLevel>${esc(d.occupationLevel)}</tem:OccupationLevel>` : ""}
          ${d.industry ? `<tem:Industry>${esc(d.industry)}</tem:Industry>` : ""}
          ${d.currentEmploymentStartDate ? `<tem:CurrentEmploymentStartDate>${esc(d.currentEmploymentStartDate)}</tem:CurrentEmploymentStartDate>` : ""}
          ${d.salaryDay ? `<tem:SalaryDay>${d.salaryDay}</tem:SalaryDay>` : ""}
          ${d.basicSalary ? `<tem:BasicSalary>${Number(d.basicSalary).toFixed(2)}</tem:BasicSalary>` : ""}
          ${d.nettSalary ? `<tem:NettSalary>${Number(d.nettSalary).toFixed(2)}</tem:NettSalary>` : ""}
          ${d.bureauExpenses ? `<tem:LoanRepayments>${Number(d.bureauExpenses).toFixed(2)}</tem:LoanRepayments>` : ""}
          <tem:FundsSource>SALARY</tem:FundsSource>
          <tem:FinanceApplication>
            <tem:CompanyCode>${env2.EDITH_COMPANY_CODE}</tem:CompanyCode>
            ${d.depositAmount ? `<tem:DepositValue>${Number(d.depositAmount).toFixed(2)}</tem:DepositValue>` : ""}
            <tem:AgreementType>INSTALMENT SALE</tem:AgreementType>
            <tem:PaymentMethod>DEBIT ORDER</tem:PaymentMethod>
          </tem:FinanceApplication>
          <tem:Consents>
            <tem:DataAttestationInd>${d.dataAttestation ? "true" : "false"}</tem:DataAttestationInd>
            <tem:TelesalesMarketingConsentInd>${d.marketingConsent ? "true" : "false"}</tem:TelesalesMarketingConsentInd>
            <tem:EmailMarketingConsentInd>${d.marketingConsent ? "true" : "false"}</tem:EmailMarketingConsentInd>
            <tem:SMSMarketingConsentInd>${d.marketingConsent ? "true" : "false"}</tem:SMSMarketingConsentInd>
            <tem:IdxConsentInd>${d.financialAccessConsent ? "true" : "false"}</tem:IdxConsentInd>
            <tem:IvxConsentInd>${d.financialAccessConsent ? "true" : "false"}</tem:IvxConsentInd>
          </tem:Consents>
        </tem:Client>
      </tem:Policy>
    </tem:CreatePolicy>
  </soap:Body>
</soap:Envelope>`;
}
__name(buildEdithXML, "buildEdithXML");
function esc(str) {
  return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
__name(esc, "esc");
function generateSalesRef(branchCode) {
  return `${branchCode}-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}
__name(generateSalesRef, "generateSalesRef");
function parseEdithXMLResponse(xml) {
  const getTag = /* @__PURE__ */ __name((tag) => {
    const match = xml.match(new RegExp(`<[^>]*${tag}[^>]*>([^<]*)<`, "i"));
    return match ? match[1].trim() : null;
  }, "getTag");
  const statusCode = parseInt(getTag("StatusCode") || getTag("ReturnCode") || "100");
  const policyNumber = getTag("PolicyNumber");
  const errors = [];
  const errorMatches = xml.matchAll(/<Error[^>]*>([\s\S]*?)<\/Error>/gi);
  for (const m of errorMatches) {
    const fieldMatch = m[1].match(/<FieldName[^>]*>([^<]*)<\/FieldName>/i);
    const codeMatch = m[1].match(/<StatusCode[^>]*>([^<]*)<\/StatusCode>/i);
    const msgMatch = m[1].match(/<ErrorMessage[^>]*>([^<]*)<\/ErrorMessage>/i);
    if (fieldMatch) {
      errors.push({
        FieldName: fieldMatch[1],
        StatusCode: parseInt(codeMatch?.[1] || "300"),
        ErrorMessage: msgMatch?.[1] || ""
      });
    }
  }
  return { statusCode, policyNumber, errors };
}
__name(parseEdithXMLResponse, "parseEdithXMLResponse");
function logError(type, data, env2, context2 = {}) {
  console.error(JSON.stringify({
    level: "error",
    type,
    ...context2,
    data,
    ts: (/* @__PURE__ */ new Date()).toISOString(),
    env: env2.WORKER_ENV
  }));
}
__name(logError, "logError");
function logWarning(type, data, env2, context2 = {}) {
  console.warn(JSON.stringify({
    level: "warn",
    type,
    ...context2,
    data,
    ts: (/* @__PURE__ */ new Date()).toISOString(),
    env: env2.WORKER_ENV
  }));
}
__name(logWarning, "logWarning");

// workers/routes/submitDocuments.js
var EDITH_WSDL_DEFAULT2 = "https://www.seritisolutions.co.za/demows/PolicyServicesV300.asmx";
var ALLOWED_EXTENSIONS = /* @__PURE__ */ new Set([
  "bmp",
  "doc",
  "docx",
  "gif",
  "jpeg",
  "jpg",
  "pdf",
  "png",
  "rtf",
  "tif",
  "tiff",
  "txt",
  "xls",
  "xlsx",
  "zip"
]);
var ALLOWED_CATEGORIES = /* @__PURE__ */ new Set([
  "BANK STATEMENT",
  "COMPANY REGISTRATION DOCUMENTS",
  "COPY OF ORIGINAL NATIS DOCUMENT",
  "COSTING SCHEDULE",
  "CPA DOCUMENTS",
  "DEA CONSENT FORM",
  "DEBT PROTECTION",
  "DECLARATION OF HEALTH",
  "DELIVERY RECEIPT",
  "DRIVERS LICENCE",
  "EMAIL CORRESPONDENCE",
  "EMPLOYMENT CONTRACT",
  "FINANCE APPLICATION",
  "FINANCE APPROVAL",
  "FINANCE CONTRACT",
  "FINANCIAL STATEMENTS",
  "HPI",
  "ID DOCUMENT",
  "IGF INVOICE",
  "INSPECTION FORM",
  "INSURANCE CONFIRMATION",
  "INSURANCE QUOTE",
  "INVOICE",
  "MARRIAGE CERTIFICATE",
  "NATIS DOCUMENT",
  "OFFER TO PURCHASE",
  "OPERATING LICENCE",
  "ORDER FORM",
  "OTHER DOCUMENT",
  "PASSPORT",
  "PRODUCT CANCELLATION FORM",
  "PRODUCT SCHEDULE",
  "PROOF OF PAYMENT",
  "PROOF OF RESIDENCE",
  "PROXY",
  "RECORD OF ADVICE",
  "RECORD OF TRANSACTION",
  "REGISTRATION CERTIFICATE",
  "REMITTANCE ADVICE",
  "RESIDENCE PERMIT",
  "ROADWORTHY CERTIFICATE",
  "ROUTE FORM",
  "SALARY SLIP",
  "SARS",
  "SHORTFALL",
  "SOURCE OF FUND DECLARATION",
  "TAXI ASSOCIATION LETTER",
  "TRACKING CERTIFICATE",
  "TRADE-IN DOCUMENTS",
  "TRANSACTION SCHEDULE",
  "VALIDATION DOCUMENTS",
  "VEHICLE HEALTH CHECK",
  "VOICE LOG"
]);
async function handleSubmitDocuments(request, ctx, jsonResponse2) {
  const { env: env2, dealerConfig, origin } = ctx;
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse2({ error: "Invalid JSON body" }, 400, origin, env2);
  }
  const { policyNumber, salesRef, documents } = body;
  if (!policyNumber) {
    return jsonResponse2({ error: "Missing policyNumber" }, 400, origin, env2);
  }
  if (!Array.isArray(documents) || documents.length === 0) {
    return jsonResponse2({ error: "No documents provided" }, 400, origin, env2);
  }
  for (const doc of documents) {
    if (!doc.base64) {
      return jsonResponse2({ error: "Each document requires base64 content" }, 400, origin, env2);
    }
    const ext = (doc.fileExtension || "").toLowerCase().replace(/^\./, "");
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return jsonResponse2({ error: `Invalid file extension: ${doc.fileExtension}` }, 400, origin, env2);
    }
    const category = (doc.category || "").toUpperCase();
    if (!ALLOWED_CATEGORIES.has(category)) {
      return jsonResponse2({ error: `Invalid document category: ${doc.category}` }, 400, origin, env2);
    }
  }
  const xml = buildSubmitDocumentsXML(documents, env2, policyNumber, dealerConfig?.branchCode, salesRef);
  console.log(JSON.stringify({
    level: "info",
    type: "edith_submit_documents_request",
    policyNumber,
    dealerKey: dealerConfig?.key,
    documentCount: documents.length,
    categories: documents.map((d) => d.category),
    ts: (/* @__PURE__ */ new Date()).toISOString()
  }));
  let edithText;
  try {
    const res = await fetch(EDITH_WSDL_DEFAULT2, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": "http://ws.edith.co.za/EdithServices/PolicyServicesV300/SubmitDocuments"
      },
      body: xml
    });
    edithText = await res.text();
    console.error("EDITH_SUBMIT_DOCS_RAW: " + edithText);
    console.log(JSON.stringify({
      level: "info",
      type: "edith_submit_documents_response",
      policyNumber,
      status: res.status,
      body: edithText,
      ts: (/* @__PURE__ */ new Date()).toISOString()
    }));
  } catch (err) {
    logError2("edith_documents_network_error", err, env2, { policyNumber });
    return jsonResponse2({
      error: "Could not connect to the finance system. Please try again."
    }, 502, origin, env2);
  }
  const parsed = parseSubmitDocumentsResponse(edithText);
  if (parsed.statusCode !== 100) {
    logError2("edith_documents_error", parsed, env2, { policyNumber });
    return jsonResponse2({
      success: false,
      error: parsed.message || "Document submission failed.",
      code: parsed.statusCode
    }, 422, origin, env2);
  }
  return jsonResponse2({
    success: true,
    policyNumber,
    message: parsed.message || "Documents submitted successfully"
  }, 200, origin, env2);
}
__name(handleSubmitDocuments, "handleSubmitDocuments");
function buildSubmitDocumentsXML(documents, env2, policyNumber, branchCode, salesRef) {
  const docsXml = documents.map((doc) => {
    const guid = crypto.randomUUID();
    const ext = (doc.fileExtension || "").toLowerCase().replace(/^\./, "");
    const category = (doc.category || "").toUpperCase();
    return `
      <tem:Document>
        <tem:Base64EncodedDocument>${doc.base64}</tem:Base64EncodedDocument>
        <tem:DocumentCategory>${esc2(category)}</tem:DocumentCategory>
        ${doc.description ? `<tem:DocumentDescription>${esc2(doc.description.slice(0, 500))}</tem:DocumentDescription>` : ""}
        <tem:DocumentGUID>${guid}</tem:DocumentGUID>
        <tem:FileExtension>${esc2(ext)}</tem:FileExtension>
        <tem:SignInd>false</tem:SignInd>
      </tem:Document>`;
  }).join("");
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://ws.edith.co.za/EdithServices/PolicyServicesV300">
  <soap:Body>
    <tem:SubmitDocuments>
      <tem:Credentials>
        <tem:CompanyCode>${env2.EDITH_COMPANY_CODE}</tem:CompanyCode>
        <tem:CompanyPassword>${env2.EDITH_COMPANY_PASS}</tem:CompanyPassword>
      </tem:Credentials>
      ${salesRef ? `<tem:SalesReferenceNumber>${esc2(salesRef)}</tem:SalesReferenceNumber>` : ""}
      ${branchCode ? `<tem:BranchCode>${esc2(branchCode)}</tem:BranchCode>` : ""}
      <tem:PolicyNumber>${esc2(policyNumber)}</tem:PolicyNumber>
      <tem:Documents>${docsXml}
      </tem:Documents>
    </tem:SubmitDocuments>
  </soap:Body>
</soap:Envelope>`;
}
__name(buildSubmitDocumentsXML, "buildSubmitDocumentsXML");
function parseSubmitDocumentsResponse(xml) {
  const getTag = /* @__PURE__ */ __name((tag) => {
    const match = xml.match(new RegExp(`<[^>]*${tag}[^>]*>([^<]*)<`, "i"));
    return match ? match[1].trim() : null;
  }, "getTag");
  const statusCode = parseInt(getTag("StatusCode") || getTag("ReturnCode") || "100");
  const message = getTag("Message");
  return { statusCode, message };
}
__name(parseSubmitDocumentsResponse, "parseSubmitDocumentsResponse");
function esc2(str) {
  return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
__name(esc2, "esc");
function logError2(type, data, env2, context2 = {}) {
  console.error(JSON.stringify({
    level: "error",
    type,
    ...context2,
    data: data instanceof Error ? data.message : data,
    ts: (/* @__PURE__ */ new Date()).toISOString(),
    env: env2.WORKER_ENV
  }));
}
__name(logError2, "logError");

// workers/routes/dealerConfig.js
async function handleDealerConfig(request, ctx, jsonResponse2) {
  const { env: env2, dealerConfig, origin } = ctx;
  return jsonResponse2({
    key: dealerConfig.key,
    name: dealerConfig.name,
    theme: dealerConfig.theme,
    features: dealerConfig.features
  }, 200, origin, env2);
}
__name(handleDealerConfig, "handleDealerConfig");

// workers/routes/addressSearch.js
async function handleAddressSearch(request, ctx, jsonResponse2) {
  const { env: env2, origin } = ctx;
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") || "").trim();
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "10", 10), 50);
  if (query.length < 2) {
    return jsonResponse2({ results: [] }, 200, origin, env2);
  }
  const db = ctx.env.DB;
  try {
    const searchTerm = `%${query}%`;
    const { results } = await db.prepare(
      `
        SELECT
          rowid          AS id,
          SUBURB         AS suburb,
          AREA           AS city,
          "STR-CODE"     AS str_code,
          "BOX-CODE"     AS box_code
        FROM postal_codes
        WHERE
          SUBURB        LIKE ?1
          OR AREA       LIKE ?1
          OR "STR-CODE" LIKE ?1
          OR "BOX-CODE" LIKE ?1
        ORDER BY
          CASE WHEN SUBURB LIKE ?2 THEN 0
               WHEN AREA   LIKE ?2 THEN 1
               ELSE 2
          END,
          SUBURB ASC
        LIMIT ?3
        `
    ).bind(searchTerm, `${query}%`, limit).all();
    const mapped = results.map((row) => {
      const postalCode = row.str_code || row.box_code || "";
      return {
        id: row.id,
        suburb: row.suburb ?? "",
        city: row.city ?? "",
        postal_code: postalCode,
        display_name: [row.suburb, row.city, postalCode].filter(Boolean).join(", ")
      };
    });
    return jsonResponse2({ results: mapped }, 200, origin, env2);
  } catch (err) {
    console.error("[address-search] D1 error:", err);
    return jsonResponse2({ error: "Search failed", details: err.message }, 500, origin, env2);
  }
}
__name(handleAddressSearch, "handleAddressSearch");

// workers/routes/lookups.js
async function handleLookups(request, ctx, jsonResponse2) {
  const { env: env2, origin } = ctx;
  const url = new URL(request.url);
  const type = url.pathname.split("/").pop();
  const query = (url.searchParams.get("q") || "").trim();
  const tableMap = {
    occupations: "occupations",
    industries: "industry_types",
    banks: "banks"
  };
  const table3 = tableMap[type];
  if (!table3) return jsonResponse2({ error: "Invalid lookup type" }, 400, origin, env2);
  const isBanks = type === "banks";
  const selectCols = isBanks ? "id, name, branch_code" : "id, name";
  try {
    let results;
    if (query.length < 1) {
      const { results: rows } = await env2.DB.prepare(
        `SELECT ${selectCols} FROM ${table3} ORDER BY name ASC LIMIT 100`
      ).all();
      results = rows;
    } else {
      const { results: rows } = await env2.DB.prepare(
        `SELECT ${selectCols} FROM ${table3} WHERE name LIKE ?1 ORDER BY name ASC LIMIT 50`
      ).bind(`%${query}%`).all();
      results = rows;
    }
    return jsonResponse2({ results }, 200, origin, env2);
  } catch (err) {
    return jsonResponse2({ error: "Lookup failed", details: err.message }, 500, origin, env2);
  }
}
__name(handleLookups, "handleLookups");

// workers/worker.js
function corsHeaders(origin, env2) {
  const allowed = isOriginAllowed(origin) || env2.WORKER_ENV === "development";
  return {
    "Access-Control-Allow-Origin": allowed ? origin : "null",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Dealer-Key",
    "Access-Control-Max-Age": "86400"
  };
}
__name(corsHeaders, "corsHeaders");
function jsonResponse(data, status = 200, origin = "*", env2 = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(origin, env2)
    }
  });
}
__name(jsonResponse, "jsonResponse");
var worker_default = {
  async fetch(request, env2, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const method = request.method;
    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin, env2) });
    }
    if (origin && env2.WORKER_ENV !== "development" && !isOriginAllowed(origin)) {
      return jsonResponse({ error: "Origin not permitted" }, 403, origin, env2);
    }
    const dealerKey = request.headers.get("X-Dealer-Key") || url.searchParams.get("dealer");
    const dealerConfig = getDealerConfig(dealerKey, origin);
    const ctx2 = { env: env2, dealerConfig, origin };
    try {
      const path = url.pathname;
      if (path === "/api/dealer/config" && method === "GET") {
        return handleDealerConfig(request, ctx2, jsonResponse);
      }
      if (path === "/api/financing/pre-qualification" && method === "POST") {
        return handlePreQual(request, ctx2, jsonResponse);
      }
      if (path === "/api/financing/prediction" && method === "POST") {
        return handlePrediction(request, ctx2, jsonResponse);
      }
      if (path === "/api/address-search" && method === "GET") {
        return handleAddressSearch(request, ctx2, jsonResponse);
      }
      if (path.startsWith("/api/lookup/") && method === "GET") {
        return handleLookups(request, ctx2, jsonResponse);
      }
      if (path === "/api/financing/applicant" && method === "GET") {
        return handleGetApplicant(request, ctx2, jsonResponse);
      }
      if (path === "/api/policy/create" && method === "POST") {
        return handleCreatePolicy(request, ctx2, jsonResponse);
      }
      if (path === "/api/policy/documents" && method === "POST") {
        return handleSubmitDocuments(request, ctx2, jsonResponse);
      }
      return jsonResponse({ error: "Not found" }, 404, origin, env2);
    } catch (err) {
      console.error("[Worker] Unhandled error:", err);
      return jsonResponse({ error: "Internal server error", details: err.message }, 500, origin, env2);
    }
  }
};
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map
