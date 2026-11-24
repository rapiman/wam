// node_modules/@webaudiomodules/sdk/dist/index.js
var WebAudioModule = class {
  static get isWebAudioModuleConstructor() {
    return true;
  }
  static createInstance(groupId, audioContext, initialState) {
    return new this(groupId, audioContext).initialize(initialState);
  }
  constructor(groupId, audioContext) {
    this._groupId = groupId;
    this._audioContext = audioContext;
    this._initialized = false;
    this._audioNode = void 0;
    this._timestamp = performance.now();
    this._guiModuleUrl = void 0;
    this._descriptorUrl = "./descriptor.json";
    this._descriptor = {
      identifier: `com.webaudiomodule.default`,
      name: `WebAudioModule_${this.constructor.name}`,
      vendor: "WebAudioModuleVendor",
      description: "",
      version: "0.0.0",
      apiVersion: "2.0.0",
      thumbnail: "",
      keywords: [],
      isInstrument: false,
      website: "",
      hasAudioInput: true,
      hasAudioOutput: true,
      hasAutomationInput: true,
      hasAutomationOutput: true,
      hasMidiInput: true,
      hasMidiOutput: true,
      hasMpeInput: true,
      hasMpeOutput: true,
      hasOscInput: true,
      hasOscOutput: true,
      hasSysexInput: true,
      hasSysexOutput: true
    };
  }
  get isWebAudioModule() {
    return true;
  }
  get groupId() {
    return this._groupId;
  }
  get moduleId() {
    return this.descriptor.identifier;
  }
  get instanceId() {
    return this.moduleId + this._timestamp;
  }
  get descriptor() {
    return this._descriptor;
  }
  get identifier() {
    return this.descriptor.identifier;
  }
  get name() {
    return this.descriptor.name;
  }
  get vendor() {
    return this.descriptor.vendor;
  }
  get audioContext() {
    return this._audioContext;
  }
  get audioNode() {
    if (!this.initialized)
      console.warn("WAM should be initialized before getting the audioNode");
    return this._audioNode;
  }
  set audioNode(node) {
    this._audioNode = node;
  }
  get initialized() {
    return this._initialized;
  }
  set initialized(value) {
    this._initialized = value;
  }
  async createAudioNode(initialState) {
    throw new TypeError("createAudioNode() not provided");
  }
  async initialize(state) {
    if (!this._audioNode)
      this.audioNode = await this.createAudioNode();
    this.initialized = true;
    return this;
  }
  async _loadGui() {
    const url = this._guiModuleUrl;
    if (!url)
      throw new TypeError("Gui module not found");
    return import(
      /* webpackIgnore: true */
      url
    );
  }
  async _loadDescriptor() {
    const url = this._descriptorUrl;
    if (!url)
      throw new TypeError("Descriptor not found");
    const response = await fetch(url);
    const descriptor = await response.json();
    Object.assign(this._descriptor, descriptor);
    return this._descriptor;
  }
  async createGui() {
    if (!this.initialized)
      console.warn("Plugin should be initialized before getting the gui");
    if (!this._guiModuleUrl)
      return void 0;
    const { createElement } = await this._loadGui();
    return createElement(this);
  }
  destroyGui() {
  }
};
var WebAudioModule_default = WebAudioModule;
var getRingBuffer = (moduleId) => {
  const audioWorkletGlobalScope = globalThis;
  class RingBuffer2 {
    static getStorageForCapacity(capacity, Type) {
      if (!Type.BYTES_PER_ELEMENT) {
        throw new Error("Pass in a ArrayBuffer subclass");
      }
      const bytes = 8 + (capacity + 1) * Type.BYTES_PER_ELEMENT;
      return new SharedArrayBuffer(bytes);
    }
    constructor(sab, Type) {
      if (!Type.BYTES_PER_ELEMENT) {
        throw new Error("Pass a concrete typed array class as second argument");
      }
      this._Type = Type;
      this._capacity = (sab.byteLength - 8) / Type.BYTES_PER_ELEMENT;
      this.buf = sab;
      this.write_ptr = new Uint32Array(this.buf, 0, 1);
      this.read_ptr = new Uint32Array(this.buf, 4, 1);
      this.storage = new Type(this.buf, 8, this._capacity);
    }
    get type() {
      return this._Type.name;
    }
    push(elements) {
      const rd = Atomics.load(this.read_ptr, 0);
      const wr = Atomics.load(this.write_ptr, 0);
      if ((wr + 1) % this._storageCapacity() === rd) {
        return 0;
      }
      const toWrite = Math.min(this._availableWrite(rd, wr), elements.length);
      const firstPart = Math.min(this._storageCapacity() - wr, toWrite);
      const secondPart = toWrite - firstPart;
      this._copy(elements, 0, this.storage, wr, firstPart);
      this._copy(elements, firstPart, this.storage, 0, secondPart);
      Atomics.store(this.write_ptr, 0, (wr + toWrite) % this._storageCapacity());
      return toWrite;
    }
    pop(elements) {
      const rd = Atomics.load(this.read_ptr, 0);
      const wr = Atomics.load(this.write_ptr, 0);
      if (wr === rd) {
        return 0;
      }
      const isArray = !Number.isInteger(elements);
      const toRead = Math.min(this._availableRead(rd, wr), isArray ? elements.length : elements);
      if (isArray) {
        const firstPart = Math.min(this._storageCapacity() - rd, toRead);
        const secondPart = toRead - firstPart;
        this._copy(this.storage, rd, elements, 0, firstPart);
        this._copy(this.storage, 0, elements, firstPart, secondPart);
      }
      Atomics.store(this.read_ptr, 0, (rd + toRead) % this._storageCapacity());
      return toRead;
    }
    get empty() {
      const rd = Atomics.load(this.read_ptr, 0);
      const wr = Atomics.load(this.write_ptr, 0);
      return wr === rd;
    }
    get full() {
      const rd = Atomics.load(this.read_ptr, 0);
      const wr = Atomics.load(this.write_ptr, 0);
      return (wr + 1) % this._capacity !== rd;
    }
    get capacity() {
      return this._capacity - 1;
    }
    get availableRead() {
      const rd = Atomics.load(this.read_ptr, 0);
      const wr = Atomics.load(this.write_ptr, 0);
      return this._availableRead(rd, wr);
    }
    get availableWrite() {
      const rd = Atomics.load(this.read_ptr, 0);
      const wr = Atomics.load(this.write_ptr, 0);
      return this._availableWrite(rd, wr);
    }
    _availableRead(rd, wr) {
      if (wr > rd) {
        return wr - rd;
      }
      return wr + this._storageCapacity() - rd;
    }
    _availableWrite(rd, wr) {
      let rv = rd - wr - 1;
      if (wr >= rd) {
        rv += this._storageCapacity();
      }
      return rv;
    }
    _storageCapacity() {
      return this._capacity;
    }
    _copy(input, offsetInput, output, offsetOutput, size) {
      for (let i = 0; i < size; i++) {
        output[offsetOutput + i] = input[offsetInput + i];
      }
    }
  }
  if (audioWorkletGlobalScope.AudioWorkletProcessor) {
    const ModuleScope = audioWorkletGlobalScope.webAudioModules.getModuleScope(moduleId);
    if (!ModuleScope.RingBuffer)
      ModuleScope.RingBuffer = RingBuffer2;
  }
  return RingBuffer2;
};
var RingBuffer_default = getRingBuffer;
var getWamArrayRingBuffer = (moduleId) => {
  const audioWorkletGlobalScope = globalThis;
  class WamArrayRingBuffer {
    static DefaultArrayCapacity = 2;
    static getStorageForEventCapacity(RingBuffer2, arrayLength, arrayType, maxArrayCapacity = void 0) {
      if (maxArrayCapacity === void 0)
        maxArrayCapacity = WamArrayRingBuffer.DefaultArrayCapacity;
      else
        maxArrayCapacity = Math.max(maxArrayCapacity, WamArrayRingBuffer.DefaultArrayCapacity);
      if (!arrayType.BYTES_PER_ELEMENT) {
        throw new Error("Pass in a ArrayBuffer subclass");
      }
      const capacity = arrayLength * maxArrayCapacity;
      return RingBuffer2.getStorageForCapacity(capacity, arrayType);
    }
    constructor(RingBuffer2, sab, arrayLength, arrayType, maxArrayCapacity = void 0) {
      if (!arrayType.BYTES_PER_ELEMENT) {
        throw new Error("Pass in a ArrayBuffer subclass");
      }
      this._arrayLength = arrayLength;
      this._arrayType = arrayType;
      this._arrayElementSizeBytes = arrayType.BYTES_PER_ELEMENT;
      this._arraySizeBytes = this._arrayLength * this._arrayElementSizeBytes;
      this._sab = sab;
      if (maxArrayCapacity === void 0)
        maxArrayCapacity = WamArrayRingBuffer.DefaultArrayCapacity;
      else
        maxArrayCapacity = Math.max(maxArrayCapacity, WamArrayRingBuffer.DefaultArrayCapacity);
      this._arrayArray = new arrayType(this._arrayLength);
      this._rb = new RingBuffer2(this._sab, arrayType);
    }
    write(array) {
      if (array.length !== this._arrayLength)
        return false;
      const elementsAvailable = this._rb.availableWrite;
      if (elementsAvailable < this._arrayLength)
        return false;
      let success = true;
      const elementsWritten = this._rb.push(array);
      if (elementsWritten != this._arrayLength)
        success = false;
      return success;
    }
    read(array, newest) {
      if (array.length !== this._arrayLength)
        return false;
      const elementsAvailable = this._rb.availableRead;
      if (elementsAvailable < this._arrayLength)
        return false;
      if (newest && elementsAvailable > this._arrayLength)
        this._rb.pop(elementsAvailable - this._arrayLength);
      let success = false;
      const elementsRead = this._rb.pop(array);
      if (elementsRead === this._arrayLength)
        success = true;
      return success;
    }
  }
  if (audioWorkletGlobalScope.AudioWorkletProcessor) {
    const ModuleScope = audioWorkletGlobalScope.webAudioModules.getModuleScope(moduleId);
    if (!ModuleScope.WamArrayRingBuffer)
      ModuleScope.WamArrayRingBuffer = WamArrayRingBuffer;
  }
  return WamArrayRingBuffer;
};
var WamArrayRingBuffer_default = getWamArrayRingBuffer;
var getWamEventRingBuffer = (moduleId) => {
  const audioWorkletGlobalScope = globalThis;
  class WamEventRingBuffer2 {
    static DefaultExtraBytesPerEvent = 64;
    static WamEventBaseBytes = 4 + 1 + 8;
    static WamAutomationEventBytes = WamEventRingBuffer2.WamEventBaseBytes + 2 + 8 + 1;
    static WamTransportEventBytes = WamEventRingBuffer2.WamEventBaseBytes + 4 + 8 + 8 + 1 + 1 + 1;
    static WamMidiEventBytes = WamEventRingBuffer2.WamEventBaseBytes + 1 + 1 + 1;
    static WamBinaryEventBytes = WamEventRingBuffer2.WamEventBaseBytes + 4;
    static getStorageForEventCapacity(RingBuffer2, eventCapacity, maxBytesPerEvent = void 0) {
      if (maxBytesPerEvent === void 0)
        maxBytesPerEvent = WamEventRingBuffer2.DefaultExtraBytesPerEvent;
      else
        maxBytesPerEvent = Math.max(maxBytesPerEvent, WamEventRingBuffer2.DefaultExtraBytesPerEvent);
      const capacity = (Math.max(WamEventRingBuffer2.WamAutomationEventBytes, WamEventRingBuffer2.WamTransportEventBytes, WamEventRingBuffer2.WamMidiEventBytes, WamEventRingBuffer2.WamBinaryEventBytes) + maxBytesPerEvent) * eventCapacity;
      return RingBuffer2.getStorageForCapacity(capacity, Uint8Array);
    }
    constructor(RingBuffer2, sab, parameterIds, maxBytesPerEvent = void 0) {
      this._eventSizeBytes = {};
      this._encodeEventType = {};
      this._decodeEventType = {};
      const wamEventTypes = ["wam-automation", "wam-transport", "wam-midi", "wam-sysex", "wam-mpe", "wam-osc", "wam-info"];
      wamEventTypes.forEach((type, encodedType) => {
        let byteSize = 0;
        switch (type) {
          case "wam-automation":
            byteSize = WamEventRingBuffer2.WamAutomationEventBytes;
            break;
          case "wam-transport":
            byteSize = WamEventRingBuffer2.WamTransportEventBytes;
            break;
          case "wam-mpe":
          case "wam-midi":
            byteSize = WamEventRingBuffer2.WamMidiEventBytes;
            break;
          case "wam-osc":
          case "wam-sysex":
          case "wam-info":
            byteSize = WamEventRingBuffer2.WamBinaryEventBytes;
            break;
          default:
            break;
        }
        this._eventSizeBytes[type] = byteSize;
        this._encodeEventType[type] = encodedType;
        this._decodeEventType[encodedType] = type;
      });
      this._parameterCode = 0;
      this._parameterCodes = {};
      this._encodeParameterId = {};
      this._decodeParameterId = {};
      this.setParameterIds(parameterIds);
      this._sab = sab;
      if (maxBytesPerEvent === void 0)
        maxBytesPerEvent = WamEventRingBuffer2.DefaultExtraBytesPerEvent;
      else
        maxBytesPerEvent = Math.max(maxBytesPerEvent, WamEventRingBuffer2.DefaultExtraBytesPerEvent);
      this._eventBytesAvailable = Math.max(WamEventRingBuffer2.WamAutomationEventBytes, WamEventRingBuffer2.WamTransportEventBytes, WamEventRingBuffer2.WamMidiEventBytes, WamEventRingBuffer2.WamBinaryEventBytes) + maxBytesPerEvent;
      this._eventBytes = new ArrayBuffer(this._eventBytesAvailable);
      this._eventBytesView = new DataView(this._eventBytes);
      this._rb = new RingBuffer2(this._sab, Uint8Array);
      this._eventSizeArray = new Uint8Array(this._eventBytes, 0, 4);
      this._eventSizeView = new DataView(this._eventBytes, 0, 4);
    }
    _writeHeader(byteSize, type, time) {
      let byteOffset = 0;
      this._eventBytesView.setUint32(byteOffset, byteSize);
      byteOffset += 4;
      this._eventBytesView.setUint8(byteOffset, this._encodeEventType[type]);
      byteOffset += 1;
      this._eventBytesView.setFloat64(byteOffset, Number.isFinite(time) ? time : -1);
      byteOffset += 8;
      return byteOffset;
    }
    _encode(event) {
      let byteOffset = 0;
      const { type, time } = event;
      switch (event.type) {
        case "wam-automation":
          {
            if (!(event.data.id in this._encodeParameterId))
              break;
            const byteSize = this._eventSizeBytes[type];
            byteOffset = this._writeHeader(byteSize, type, time);
            const { data } = event;
            const encodedParameterId = this._encodeParameterId[data.id];
            const { value, normalized } = data;
            this._eventBytesView.setUint16(byteOffset, encodedParameterId);
            byteOffset += 2;
            this._eventBytesView.setFloat64(byteOffset, value);
            byteOffset += 8;
            this._eventBytesView.setUint8(byteOffset, normalized ? 1 : 0);
            byteOffset += 1;
          }
          break;
        case "wam-transport":
          {
            const byteSize = this._eventSizeBytes[type];
            byteOffset = this._writeHeader(byteSize, type, time);
            const { data } = event;
            const {
              currentBar,
              currentBarStarted,
              tempo,
              timeSigNumerator,
              timeSigDenominator,
              playing
            } = data;
            this._eventBytesView.setUint32(byteOffset, currentBar);
            byteOffset += 4;
            this._eventBytesView.setFloat64(byteOffset, currentBarStarted);
            byteOffset += 8;
            this._eventBytesView.setFloat64(byteOffset, tempo);
            byteOffset += 8;
            this._eventBytesView.setUint8(byteOffset, timeSigNumerator);
            byteOffset += 1;
            this._eventBytesView.setUint8(byteOffset, timeSigDenominator);
            byteOffset += 1;
            this._eventBytesView.setUint8(byteOffset, playing ? 1 : 0);
            byteOffset += 1;
          }
          break;
        case "wam-mpe":
        case "wam-midi":
          {
            const byteSize = this._eventSizeBytes[type];
            byteOffset = this._writeHeader(byteSize, type, time);
            const { data } = event;
            const { bytes } = data;
            let b = 0;
            while (b < 3) {
              this._eventBytesView.setUint8(byteOffset, bytes[b]);
              byteOffset += 1;
              b++;
            }
          }
          break;
        case "wam-osc":
        case "wam-sysex":
        case "wam-info":
          {
            let bytes = null;
            if (event.type === "wam-info") {
              const { data } = event;
              bytes = new TextEncoder().encode(data.instanceId);
            } else {
              const { data } = event;
              bytes = data.bytes;
            }
            const numBytes = bytes.length;
            const byteSize = this._eventSizeBytes[type];
            byteOffset = this._writeHeader(byteSize + numBytes, type, time);
            this._eventBytesView.setUint32(byteOffset, numBytes);
            byteOffset += 4;
            const bytesRequired = byteOffset + numBytes;
            if (bytesRequired > this._eventBytesAvailable)
              console.error(`Event requires ${bytesRequired} bytes but only ${this._eventBytesAvailable} have been allocated!`);
            const buffer = new Uint8Array(this._eventBytes, byteOffset, numBytes);
            buffer.set(bytes);
            byteOffset += numBytes;
          }
          break;
        default:
          break;
      }
      return new Uint8Array(this._eventBytes, 0, byteOffset);
    }
    _decode() {
      let byteOffset = 0;
      const type = this._decodeEventType[this._eventBytesView.getUint8(byteOffset)];
      byteOffset += 1;
      let time = this._eventBytesView.getFloat64(byteOffset);
      if (time === -1)
        time = void 0;
      byteOffset += 8;
      switch (type) {
        case "wam-automation": {
          const encodedParameterId = this._eventBytesView.getUint16(byteOffset);
          byteOffset += 2;
          const value = this._eventBytesView.getFloat64(byteOffset);
          byteOffset += 8;
          const normalized = !!this._eventBytesView.getUint8(byteOffset);
          byteOffset += 1;
          if (!(encodedParameterId in this._decodeParameterId))
            break;
          const id = this._decodeParameterId[encodedParameterId];
          const event = {
            type,
            time,
            data: {
              id,
              value,
              normalized
            }
          };
          return event;
        }
        case "wam-transport": {
          const currentBar = this._eventBytesView.getUint32(byteOffset);
          byteOffset += 4;
          const currentBarStarted = this._eventBytesView.getFloat64(byteOffset);
          byteOffset += 8;
          const tempo = this._eventBytesView.getFloat64(byteOffset);
          byteOffset += 8;
          const timeSigNumerator = this._eventBytesView.getUint8(byteOffset);
          byteOffset += 1;
          const timeSigDenominator = this._eventBytesView.getUint8(byteOffset);
          byteOffset += 1;
          const playing = this._eventBytesView.getUint8(byteOffset) == 1;
          byteOffset += 1;
          const event = {
            type,
            time,
            data: {
              currentBar,
              currentBarStarted,
              tempo,
              timeSigNumerator,
              timeSigDenominator,
              playing
            }
          };
          return event;
        }
        case "wam-mpe":
        case "wam-midi": {
          const bytes = [0, 0, 0];
          let b = 0;
          while (b < 3) {
            bytes[b] = this._eventBytesView.getUint8(byteOffset);
            byteOffset += 1;
            b++;
          }
          const event = {
            type,
            time,
            data: { bytes }
          };
          return event;
        }
        case "wam-osc":
        case "wam-sysex":
        case "wam-info": {
          const numBytes = this._eventBytesView.getUint32(byteOffset);
          byteOffset += 4;
          const bytes = new Uint8Array(numBytes);
          bytes.set(new Uint8Array(this._eventBytes, byteOffset, numBytes));
          byteOffset += numBytes;
          if (type === "wam-info") {
            const instanceId = new TextDecoder().decode(bytes);
            const data = { instanceId };
            return { type, time, data };
          } else {
            const data = { bytes };
            return { type, time, data };
          }
        }
        default:
          break;
      }
      return false;
    }
    write(...events) {
      const numEvents = events.length;
      let bytesAvailable = this._rb.availableWrite;
      let numSkipped = 0;
      let i = 0;
      while (i < numEvents) {
        const event = events[i];
        const bytes = this._encode(event);
        const eventSizeBytes = bytes.byteLength;
        let bytesWritten = 0;
        if (bytesAvailable >= eventSizeBytes) {
          if (eventSizeBytes === 0)
            numSkipped++;
          else
            bytesWritten = this._rb.push(bytes);
        } else
          break;
        bytesAvailable -= bytesWritten;
        i++;
      }
      return i - numSkipped;
    }
    read() {
      if (this._rb.empty)
        return [];
      const events = [];
      let bytesAvailable = this._rb.availableRead;
      let bytesRead = 0;
      while (bytesAvailable > 0) {
        bytesRead = this._rb.pop(this._eventSizeArray);
        bytesAvailable -= bytesRead;
        const eventSizeBytes = this._eventSizeView.getUint32(0);
        const eventBytes = new Uint8Array(this._eventBytes, 0, eventSizeBytes - 4);
        bytesRead = this._rb.pop(eventBytes);
        bytesAvailable -= bytesRead;
        const decodedEvent = this._decode();
        if (decodedEvent)
          events.push(decodedEvent);
      }
      return events;
    }
    setParameterIds(parameterIds) {
      this._encodeParameterId = {};
      this._decodeParameterId = {};
      parameterIds.forEach((parameterId) => {
        let parameterCode = -1;
        if (parameterId in this._parameterCodes)
          parameterCode = this._parameterCodes[parameterId];
        else {
          parameterCode = this._generateParameterCode();
          this._parameterCodes[parameterId] = parameterCode;
        }
        this._encodeParameterId[parameterId] = parameterCode;
        this._decodeParameterId[parameterCode] = parameterId;
      });
    }
    _generateParameterCode() {
      if (this._parameterCode > 65535)
        throw Error("Too many parameters have been registered!");
      return this._parameterCode++;
    }
  }
  if (audioWorkletGlobalScope.AudioWorkletProcessor) {
    const ModuleScope = audioWorkletGlobalScope.webAudioModules.getModuleScope(moduleId);
    if (!ModuleScope.WamEventRingBuffer)
      ModuleScope.WamEventRingBuffer = WamEventRingBuffer2;
  }
  return WamEventRingBuffer2;
};
var WamEventRingBuffer_default = getWamEventRingBuffer;
var addFunctionModule = (audioWorklet, processorFunction, ...injection) => {
  const text = `(${processorFunction.toString()})(${injection.map((s) => JSON.stringify(s)).join(", ")});`;
  const url = URL.createObjectURL(new Blob([text], { type: "text/javascript" }));
  return audioWorklet.addModule(url);
};
var addFunctionModule_default = addFunctionModule;
var getWamParameter = (moduleId) => {
  const audioWorkletGlobalScope = globalThis;
  class WamParameter {
    constructor(info) {
      this.info = info;
      this._value = info.defaultValue;
    }
    set value(value) {
      this._value = value;
    }
    get value() {
      return this._value;
    }
    set normalizedValue(valueNorm) {
      this.value = this.info.denormalize(valueNorm);
    }
    get normalizedValue() {
      return this.info.normalize(this.value);
    }
  }
  if (audioWorkletGlobalScope.AudioWorkletProcessor) {
    const ModuleScope = audioWorkletGlobalScope.webAudioModules.getModuleScope(moduleId);
    if (!ModuleScope.WamParameter)
      ModuleScope.WamParameter = WamParameter;
  }
  return WamParameter;
};
var WamParameter_default = getWamParameter;
var getWamParameterInfo = (moduleId) => {
  const audioWorkletGlobalScope = globalThis;
  const normExp = (x, e) => e === 0 ? x : x ** 1.5 ** -e;
  const denormExp = (x, e) => e === 0 ? x : x ** 1.5 ** e;
  const normalize = (x, min, max, e = 0) => min === 0 && max === 1 ? normExp(x, e) : normExp((x - min) / (max - min) || 0, e);
  const denormalize = (x, min, max, e = 0) => min === 0 && max === 1 ? denormExp(x, e) : denormExp(x, e) * (max - min) + min;
  const inRange = (x, min, max) => x >= min && x <= max;
  class WamParameterInfo {
    constructor(id, config = {}) {
      let {
        type,
        label,
        defaultValue,
        minValue,
        maxValue,
        discreteStep,
        exponent,
        choices,
        units
      } = config;
      if (type === void 0)
        type = "float";
      if (label === void 0)
        label = "";
      if (defaultValue === void 0)
        defaultValue = 0;
      if (choices === void 0)
        choices = [];
      if (type === "boolean" || type === "choice") {
        discreteStep = 1;
        minValue = 0;
        if (choices.length)
          maxValue = choices.length - 1;
        else
          maxValue = 1;
      } else {
        if (minValue === void 0)
          minValue = 0;
        if (maxValue === void 0)
          maxValue = 1;
        if (discreteStep === void 0)
          discreteStep = 0;
        if (exponent === void 0)
          exponent = 0;
        if (units === void 0)
          units = "";
      }
      const errBase = `Param config error | ${id}: `;
      if (minValue >= maxValue)
        throw Error(errBase.concat("minValue must be less than maxValue"));
      if (!inRange(defaultValue, minValue, maxValue))
        throw Error(errBase.concat("defaultValue out of range"));
      if (discreteStep % 1 || discreteStep < 0) {
        throw Error(errBase.concat("discreteStep must be a non-negative integer"));
      } else if (discreteStep > 0 && (minValue % 1 || maxValue % 1 || defaultValue % 1)) {
        throw Error(errBase.concat("non-zero discreteStep requires integer minValue, maxValue, and defaultValue"));
      }
      if (type === "choice" && !choices.length) {
        throw Error(errBase.concat("choice type parameter requires list of strings in choices"));
      }
      this.id = id;
      this.label = label;
      this.type = type;
      this.defaultValue = defaultValue;
      this.minValue = minValue;
      this.maxValue = maxValue;
      this.discreteStep = discreteStep;
      this.exponent = exponent;
      this.choices = choices;
      this.units = units;
    }
    normalize(value) {
      return normalize(value, this.minValue, this.maxValue, this.exponent);
    }
    denormalize(valueNorm) {
      return denormalize(valueNorm, this.minValue, this.maxValue, this.exponent);
    }
    valueString(value) {
      if (this.choices)
        return this.choices[value];
      if (this.units !== "")
        return `${value} ${this.units}`;
      return `${value}`;
    }
  }
  if (audioWorkletGlobalScope.AudioWorkletProcessor) {
    const ModuleScope = audioWorkletGlobalScope.webAudioModules.getModuleScope(moduleId);
    if (!ModuleScope.WamParameterInfo)
      ModuleScope.WamParameterInfo = WamParameterInfo;
  }
  return WamParameterInfo;
};
var WamParameterInfo_default = getWamParameterInfo;
var getWamParameterInterpolator = (moduleId) => {
  const audioWorkletGlobalScope = globalThis;
  const samplesPerQuantum = 128;
  const nullTableKey = "0_0";
  class WamParameterInterpolator {
    static _tables;
    static _tableReferences;
    constructor(info, samplesPerInterpolation, skew = 0) {
      if (!WamParameterInterpolator._tables) {
        WamParameterInterpolator._tables = { nullTableKey: new Float32Array(0) };
        WamParameterInterpolator._tableReferences = { nullTableKey: [] };
      }
      this.info = info;
      this.values = new Float32Array(samplesPerQuantum);
      this._tableKey = nullTableKey;
      this._table = WamParameterInterpolator._tables[this._tableKey];
      this._skew = 2;
      const { discreteStep } = info;
      this._discrete = !!discreteStep;
      this._N = this._discrete ? 0 : samplesPerInterpolation;
      this._n = 0;
      this._startValue = info.defaultValue;
      this._endValue = info.defaultValue;
      this._currentValue = info.defaultValue;
      this._deltaValue = 0;
      this._inverted = false;
      this._changed = true;
      this._filled = 0;
      if (!this._discrete)
        this.setSkew(skew);
      else
        this._skew = 0;
      this.setStartValue(this._startValue);
    }
    _removeTableReference(oldKey) {
      if (oldKey === nullTableKey)
        return;
      const { id } = this.info;
      const references = WamParameterInterpolator._tableReferences[oldKey];
      if (references) {
        const index = references.indexOf(id);
        if (index !== -1)
          references.splice(index, 1);
        if (references.length === 0) {
          delete WamParameterInterpolator._tables[oldKey];
          delete WamParameterInterpolator._tableReferences[oldKey];
        }
      }
    }
    setSkew(skew) {
      if (this._skew === skew || this._discrete)
        return;
      if (skew < -1 || skew > 1)
        throw Error("skew must be in range [-1.0, 1.0]");
      const newKey = [this._N, skew].join("_");
      const oldKey = this._tableKey;
      const { id } = this.info;
      if (newKey === oldKey)
        return;
      if (WamParameterInterpolator._tables[newKey]) {
        const references = WamParameterInterpolator._tableReferences[newKey];
        if (references)
          references.push(id);
        else
          WamParameterInterpolator._tableReferences[newKey] = [id];
      } else {
        let e = Math.abs(skew);
        e = Math.pow(3 - e, e * (e + 2));
        const linear = e === 1;
        const N = this._N;
        const table = new Float32Array(N + 1);
        if (linear)
          for (let n = 0; n <= N; ++n)
            table[n] = n / N;
        else
          for (let n = 0; n <= N; ++n)
            table[n] = (n / N) ** e;
        WamParameterInterpolator._tables[newKey] = table;
        WamParameterInterpolator._tableReferences[newKey] = [id];
      }
      this._removeTableReference(oldKey);
      this._skew = skew;
      this._tableKey = newKey;
      this._table = WamParameterInterpolator._tables[this._tableKey];
    }
    setStartValue(value, fill = true) {
      this._n = this._N;
      this._startValue = value;
      this._endValue = value;
      this._currentValue = value;
      this._deltaValue = 0;
      this._inverted = false;
      if (fill) {
        this.values.fill(value);
        this._changed = true;
        this._filled = this.values.length;
      } else {
        this._changed = false;
        this._filled = 0;
      }
    }
    setEndValue(value) {
      if (value === this._endValue)
        return;
      this._n = 0;
      this._startValue = this._currentValue;
      this._endValue = value;
      this._deltaValue = this._endValue - this._startValue;
      this._inverted = this._deltaValue > 0 && this._skew >= 0 || this._deltaValue <= 0 && this._skew < 0;
      this._changed = false;
      this._filled = 0;
    }
    process(startSample, endSample) {
      if (this.done)
        return;
      const length = endSample - startSample;
      let fill = 0;
      const change = this._N - this._n;
      if (this._discrete || !change)
        fill = length;
      else {
        if (change < length) {
          fill = Math.min(length - change, samplesPerQuantum);
          endSample -= fill;
        }
        if (endSample > startSample) {
          if (this._inverted) {
            for (let i = startSample; i < endSample; ++i) {
              const tableValue = 1 - this._table[this._N - ++this._n];
              this.values[i] = this._startValue + tableValue * this._deltaValue;
            }
          } else {
            for (let i = startSample; i < endSample; ++i) {
              const tableValue = this._table[++this._n];
              this.values[i] = this._startValue + tableValue * this._deltaValue;
            }
          }
        }
        if (fill > 0) {
          startSample = endSample;
          endSample += fill;
        }
      }
      if (fill > 0) {
        this.values.fill(this._endValue, startSample, endSample);
        this._filled += fill;
      }
      this._currentValue = this.values[endSample - 1];
      if (this._n === this._N) {
        if (!this._changed)
          this._changed = true;
        else if (this._filled >= this.values.length) {
          this.setStartValue(this._endValue, false);
          this._changed = true;
          this._filled = this.values.length;
        }
      }
    }
    get done() {
      return this._changed && this._filled === this.values.length;
    }
    is(value) {
      return this._endValue === value && this.done;
    }
    destroy() {
      this._removeTableReference(this._tableKey);
    }
  }
  if (audioWorkletGlobalScope.AudioWorkletProcessor) {
    const ModuleScope = audioWorkletGlobalScope.webAudioModules.getModuleScope(moduleId);
    if (!ModuleScope.WamParameterInterpolator)
      ModuleScope.WamParameterInterpolator = WamParameterInterpolator;
  }
  return WamParameterInterpolator;
};
var WamParameterInterpolator_default = getWamParameterInterpolator;
var getWamProcessor = (moduleId) => {
  const audioWorkletGlobalScope = globalThis;
  const {
    AudioWorkletProcessor,
    webAudioModules
  } = audioWorkletGlobalScope;
  const ModuleScope = audioWorkletGlobalScope.webAudioModules.getModuleScope(moduleId);
  const {
    RingBuffer: RingBuffer2,
    WamEventRingBuffer: WamEventRingBuffer2,
    WamParameter,
    WamParameterInterpolator
  } = ModuleScope;
  class WamProcessor extends AudioWorkletProcessor {
    constructor(options) {
      super();
      const {
        groupId,
        moduleId: moduleId2,
        instanceId,
        useSab
      } = options.processorOptions;
      if (!moduleId2)
        throw Error("must provide moduleId argument in processorOptions!");
      if (!instanceId)
        throw Error("must provide instanceId argument in processorOptions!");
      this.groupId = groupId;
      this.moduleId = moduleId2;
      this.instanceId = instanceId;
      this._samplesPerQuantum = 128;
      this._compensationDelay = 0;
      this._parameterInfo = {};
      this._parameterState = {};
      this._parameterInterpolators = {};
      this._eventQueue = [];
      this._pendingResponses = {};
      this._useSab = !!useSab && !!globalThis.SharedArrayBuffer;
      this._eventSabReady = false;
      this._audioToMainEventSab = null;
      this._mainToAudioEventSab = null;
      this._eventWriter = null;
      this._eventReader = null;
      this._initialized = false;
      this._destroyed = false;
      this._eventQueueRequiresSort = false;
      webAudioModules.addWam(this);
      this.port.onmessage = this._onMessage.bind(this);
      if (this._useSab)
        this._configureSab();
    }
    getCompensationDelay() {
      return this._compensationDelay;
    }
    scheduleEvents(...events) {
      let i = 0;
      while (i < events.length) {
        this._eventQueue.push({ id: 0, event: events[i] });
        i++;
      }
      this._eventQueueRequiresSort = this._eventQueue.length > 1;
    }
    emitEvents(...events) {
      webAudioModules.emitEvents(this, ...events);
    }
    clearEvents() {
      this._eventQueue = [];
    }
    process(inputs, outputs, parameters) {
      if (!this._initialized)
        return true;
      if (this._destroyed)
        return false;
      if (this._eventSabReady)
        this.scheduleEvents(...this._eventReader.read());
      const processingSlices = this._getProcessingSlices();
      let i = 0;
      while (i < processingSlices.length) {
        const { range, events } = processingSlices[i];
        const [startSample, endSample] = range;
        let j = 0;
        while (j < events.length) {
          this._processEvent(events[j]);
          j++;
        }
        this._interpolateParameterValues(startSample, endSample);
        this._process(startSample, endSample, inputs, outputs, parameters);
        i++;
      }
      return true;
    }
    destroy() {
      this._destroyed = true;
      this.port.close();
      webAudioModules.removeWam(this);
    }
    _generateWamParameterInfo() {
      return {};
    }
    _initialize() {
      this._parameterState = {};
      this._parameterInterpolators = {};
      this._parameterInfo = this._generateWamParameterInfo();
      Object.keys(this._parameterInfo).forEach((parameterId) => {
        const info = this._parameterInfo[parameterId];
        this._parameterState[parameterId] = new WamParameter(this._parameterInfo[parameterId]);
        this._parameterInterpolators[parameterId] = new WamParameterInterpolator(info, 256);
      });
    }
    _configureSab() {
      const eventCapacity = 2 ** 10;
      const parameterIds = Object.keys(this._parameterInfo);
      if (this._eventSabReady) {
        this._eventWriter.setParameterIds(parameterIds);
        this._eventReader.setParameterIds(parameterIds);
      }
      this.port.postMessage({ eventSab: { eventCapacity, parameterIds } });
    }
    async _onMessage(message) {
      if (message.data.request) {
        const {
          id,
          request,
          content
        } = message.data;
        const response = { id, response: request };
        const requestComponents = request.split("/");
        const verb = requestComponents[0];
        const noun = requestComponents[1];
        response.content = "error";
        if (verb === "get") {
          if (noun === "parameterInfo") {
            let { parameterIds } = content;
            if (!parameterIds.length)
              parameterIds = Object.keys(this._parameterInfo);
            const parameterInfo = {};
            let i = 0;
            while (i < parameterIds.length) {
              const parameterId = parameterIds[i];
              parameterInfo[parameterId] = this._parameterInfo[parameterId];
              i++;
            }
            response.content = parameterInfo;
          } else if (noun === "parameterValues") {
            let { normalized, parameterIds } = content;
            response.content = this._getParameterValues(normalized, parameterIds);
          } else if (noun === "state") {
            response.content = this._getState();
          } else if (noun === "compensationDelay") {
            response.content = this.getCompensationDelay();
          }
        } else if (verb === "set") {
          if (noun === "parameterValues") {
            const { parameterValues } = content;
            this._setParameterValues(parameterValues, true);
            delete response.content;
          } else if (noun === "state") {
            const { state } = content;
            this._setState(state);
            delete response.content;
          }
        } else if (verb === "add") {
          if (noun === "event") {
            const { event } = content;
            this._eventQueue.push({ id, event });
            this._eventQueueRequiresSort = this._eventQueue.length > 1;
            return;
          }
        } else if (verb === "remove") {
          if (noun === "events") {
            const ids = this._eventQueue.map((queued) => queued.id);
            this.clearEvents();
            response.content = ids;
          }
        } else if (verb === "connect") {
          if (noun === "events") {
            const { wamInstanceId, output } = content;
            this._connectEvents(wamInstanceId, output);
            delete response.content;
          }
        } else if (verb === "disconnect") {
          if (noun === "events") {
            const { wamInstanceId, output } = content;
            this._disconnectEvents(wamInstanceId, output);
            delete response.content;
          }
        } else if (verb === "initialize") {
          if (noun === "processor") {
            this._initialize();
            this._initialized = true;
            delete response.content;
          } else if (noun === "eventSab") {
            const { mainToAudioEventSab, audioToMainEventSab } = content;
            this._audioToMainEventSab = audioToMainEventSab;
            this._mainToAudioEventSab = mainToAudioEventSab;
            const parameterIds = Object.keys(this._parameterInfo);
            this._eventWriter = new WamEventRingBuffer2(RingBuffer2, this._audioToMainEventSab, parameterIds);
            this._eventReader = new WamEventRingBuffer2(RingBuffer2, this._mainToAudioEventSab, parameterIds);
            this._eventSabReady = true;
            delete response.content;
          }
        }
        this.port.postMessage(response);
      } else if (message.data.destroy) {
        this.destroy();
      }
    }
    _onTransport(transportData) {
      console.error("_onTransport not implemented!");
    }
    _onMidi(midiData) {
      console.error("_onMidi not implemented!");
    }
    _onSysex(sysexData) {
      console.error("_onMidi not implemented!");
    }
    _onMpe(mpeData) {
      console.error("_onMpe not implemented!");
    }
    _onOsc(oscData) {
      console.error("_onOsc not implemented!");
    }
    _setState(state) {
      if (state.parameterValues)
        this._setParameterValues(state.parameterValues, false);
    }
    _getState() {
      return { parameterValues: this._getParameterValues(false) };
    }
    _getParameterValues(normalized, parameterIds) {
      const parameterValues = {};
      if (!parameterIds || !parameterIds.length)
        parameterIds = Object.keys(this._parameterState);
      let i = 0;
      while (i < parameterIds.length) {
        const id = parameterIds[i];
        const parameter = this._parameterState[id];
        parameterValues[id] = {
          id,
          value: normalized ? parameter.normalizedValue : parameter.value,
          normalized
        };
        i++;
      }
      return parameterValues;
    }
    _setParameterValues(parameterUpdates, interpolate) {
      const parameterIds = Object.keys(parameterUpdates);
      let i = 0;
      while (i < parameterIds.length) {
        this._setParameterValue(parameterUpdates[parameterIds[i]], interpolate);
        i++;
      }
    }
    _setParameterValue(parameterUpdate, interpolate) {
      const { id, value, normalized } = parameterUpdate;
      const parameter = this._parameterState[id];
      if (!parameter)
        return;
      if (!normalized)
        parameter.value = value;
      else
        parameter.normalizedValue = value;
      const interpolator = this._parameterInterpolators[id];
      if (interpolate)
        interpolator.setEndValue(parameter.value);
      else
        interpolator.setStartValue(parameter.value);
    }
    _interpolateParameterValues(startIndex, endIndex) {
      const parameterIds = Object.keys(this._parameterInterpolators);
      let i = 0;
      while (i < parameterIds.length) {
        this._parameterInterpolators[parameterIds[i]].process(startIndex, endIndex);
        i++;
      }
    }
    _connectEvents(wamInstanceId, output) {
      webAudioModules.connectEvents(this.groupId, this.instanceId, wamInstanceId, output);
    }
    _disconnectEvents(wamInstanceId, output) {
      if (typeof wamInstanceId === "undefined") {
        webAudioModules.disconnectEvents(this.groupId, this.instanceId);
        return;
      }
      webAudioModules.disconnectEvents(this.groupId, this.instanceId, wamInstanceId, output);
    }
    _getProcessingSlices() {
      const response = "add/event";
      const { currentTime, sampleRate: sampleRate2 } = audioWorkletGlobalScope;
      const eventsBySampleIndex = {};
      if (this._eventQueueRequiresSort) {
        this._eventQueue.sort((a, b) => a.event.time - b.event.time);
        this._eventQueueRequiresSort = false;
      }
      let i = 0;
      while (i < this._eventQueue.length) {
        const { id, event } = this._eventQueue[i];
        const offsetSec = event.time - currentTime;
        const sampleIndex = offsetSec > 0 ? Math.round(offsetSec * sampleRate2) : 0;
        if (sampleIndex < this._samplesPerQuantum) {
          if (eventsBySampleIndex[sampleIndex])
            eventsBySampleIndex[sampleIndex].push(event);
          else
            eventsBySampleIndex[sampleIndex] = [event];
          if (id)
            this.port.postMessage({ id, response });
          else if (this._eventSabReady)
            this._eventWriter.write(event);
          else
            this.port.postMessage({ event });
          this._eventQueue.shift();
          i = -1;
        } else
          break;
        i++;
      }
      const processingSlices = [];
      const keys = Object.keys(eventsBySampleIndex);
      if (keys[0] !== "0") {
        keys.unshift("0");
        eventsBySampleIndex["0"] = [];
      }
      const lastIndex = keys.length - 1;
      i = 0;
      while (i < keys.length) {
        const key = keys[i];
        const startSample = parseInt(key);
        const endSample = i < lastIndex ? parseInt(keys[i + 1]) : this._samplesPerQuantum;
        processingSlices.push({ range: [startSample, endSample], events: eventsBySampleIndex[key] });
        i++;
      }
      return processingSlices;
    }
    _processEvent(event) {
      switch (event.type) {
        case "wam-automation":
          this._setParameterValue(event.data, true);
          break;
        case "wam-transport":
          this._onTransport(event.data);
          break;
        case "wam-midi":
          this._onMidi(event.data);
          break;
        case "wam-sysex":
          this._onSysex(event.data);
          break;
        case "wam-mpe":
          this._onMpe(event.data);
          break;
        case "wam-osc":
          this._onOsc(event.data);
          break;
        default:
          break;
      }
    }
    _process(startSample, endSample, inputs, outputs, parameters) {
      console.error("_process not implemented!");
    }
  }
  if (audioWorkletGlobalScope.AudioWorkletProcessor) {
    if (!ModuleScope.WamProcessor)
      ModuleScope.WamProcessor = WamProcessor;
  }
  return WamProcessor;
};
var WamProcessor_default = getWamProcessor;
var RingBuffer = RingBuffer_default();
var WamEventRingBuffer = WamEventRingBuffer_default();
var WamNode = class extends AudioWorkletNode {
  static async addModules(audioContext, moduleId) {
    const { audioWorklet } = audioContext;
    await addFunctionModule_default(audioWorklet, RingBuffer_default, moduleId);
    await addFunctionModule_default(audioWorklet, WamEventRingBuffer_default, moduleId);
    await addFunctionModule_default(audioWorklet, WamArrayRingBuffer_default, moduleId);
    await addFunctionModule_default(audioWorklet, WamParameter_default, moduleId);
    await addFunctionModule_default(audioWorklet, WamParameterInfo_default, moduleId);
    await addFunctionModule_default(audioWorklet, WamParameterInterpolator_default, moduleId);
    await addFunctionModule_default(audioWorklet, WamProcessor_default, moduleId);
  }
  constructor(module, options) {
    const { audioContext, groupId, moduleId, instanceId } = module;
    options.processorOptions = {
      groupId,
      moduleId,
      instanceId,
      ...options.processorOptions
    };
    super(audioContext, moduleId, options);
    this.module = module;
    this._supportedEventTypes = /* @__PURE__ */ new Set(["wam-automation", "wam-transport", "wam-midi", "wam-sysex", "wam-mpe", "wam-osc"]);
    this._messageId = 1;
    this._pendingResponses = {};
    this._pendingEvents = {};
    this._useSab = false;
    this._eventSabReady = false;
    this._destroyed = false;
    this.port.onmessage = this._onMessage.bind(this);
  }
  get groupId() {
    return this.module.groupId;
  }
  get moduleId() {
    return this.module.moduleId;
  }
  get instanceId() {
    return this.module.instanceId;
  }
  async getParameterInfo(...parameterIds) {
    const request = "get/parameterInfo";
    const id = this._generateMessageId();
    return new Promise((resolve) => {
      this._pendingResponses[id] = resolve;
      this.port.postMessage({
        id,
        request,
        content: { parameterIds }
      });
    });
  }
  async getParameterValues(normalized, ...parameterIds) {
    const request = "get/parameterValues";
    const id = this._generateMessageId();
    return new Promise((resolve) => {
      this._pendingResponses[id] = resolve;
      this.port.postMessage({
        id,
        request,
        content: { normalized, parameterIds }
      });
    });
  }
  async setParameterValues(parameterValues) {
    const request = "set/parameterValues";
    const id = this._generateMessageId();
    return new Promise((resolve) => {
      this._pendingResponses[id] = resolve;
      this.port.postMessage({
        id,
        request,
        content: { parameterValues }
      });
    });
  }
  async getState() {
    const request = "get/state";
    const id = this._generateMessageId();
    return new Promise((resolve) => {
      this._pendingResponses[id] = resolve;
      this.port.postMessage({ id, request });
    });
  }
  async setState(state) {
    const request = "set/state";
    const id = this._generateMessageId();
    return new Promise((resolve) => {
      this._pendingResponses[id] = resolve;
      this.port.postMessage({
        id,
        request,
        content: { state }
      });
    });
  }
  async getCompensationDelay() {
    const request = "get/compensationDelay";
    const id = this._generateMessageId();
    return new Promise((resolve) => {
      this._pendingResponses[id] = resolve;
      this.port.postMessage({ id, request });
    });
  }
  addEventListener(type, callback, options) {
    if (this._supportedEventTypes.has(type))
      super.addEventListener(type, callback, options);
  }
  removeEventListener(type, callback, options) {
    if (this._supportedEventTypes.has(type))
      super.removeEventListener(type, callback, options);
  }
  scheduleEvents(...events) {
    let i = 0;
    const numEvents = events.length;
    if (this._eventSabReady) {
      i = this._eventWriter.write(...events);
    }
    while (i < numEvents) {
      const event = events[i];
      const request = "add/event";
      const id = this._generateMessageId();
      let processed = false;
      new Promise((resolve, reject) => {
        this._pendingResponses[id] = resolve;
        this._pendingEvents[id] = () => {
          if (!processed)
            reject();
        };
        this.port.postMessage({
          id,
          request,
          content: { event }
        });
      }).then((resolved) => {
        processed = true;
        delete this._pendingEvents[id];
        this._onEvent(event);
      }).catch((rejected) => {
        delete this._pendingResponses[id];
      });
      i++;
    }
  }
  async clearEvents() {
    const request = "remove/events";
    const id = this._generateMessageId();
    const ids = Object.keys(this._pendingEvents);
    if (ids.length) {
      return new Promise((resolve) => {
        this._pendingResponses[id] = resolve;
        this.port.postMessage({ id, request });
      }).then((clearedIds) => {
        clearedIds.forEach((clearedId) => {
          this._pendingEvents[clearedId]();
          delete this._pendingEvents[clearedId];
        });
      });
    }
  }
  connectEvents(toId, output) {
    const request = "connect/events";
    const id = this._generateMessageId();
    new Promise((resolve, reject) => {
      this._pendingResponses[id] = resolve;
      this.port.postMessage({
        id,
        request,
        content: { wamInstanceId: toId, output }
      });
    });
  }
  disconnectEvents(toId, output) {
    const request = "disconnect/events";
    const id = this._generateMessageId();
    new Promise((resolve, reject) => {
      this._pendingResponses[id] = resolve;
      this.port.postMessage({
        id,
        request,
        content: { wamInstanceId: toId, output }
      });
    });
  }
  destroy() {
    if (this._audioToMainInterval)
      clearInterval(this._audioToMainInterval);
    this.port.postMessage({ destroy: true });
    this.port.close();
    this.disconnect();
    this._destroyed = true;
  }
  _generateMessageId() {
    return this._messageId++;
  }
  async _initialize() {
    const request = "initialize/processor";
    const id = this._generateMessageId();
    return new Promise((resolve) => {
      this._pendingResponses[id] = resolve;
      this.port.postMessage({ id, request });
    });
  }
  _onMessage(message) {
    const { data } = message;
    const { response, event, eventSab } = data;
    if (response) {
      const { id, content } = data;
      const resolvePendingResponse = this._pendingResponses[id];
      if (resolvePendingResponse) {
        delete this._pendingResponses[id];
        resolvePendingResponse(content);
      }
    } else if (eventSab) {
      this._useSab = true;
      const { eventCapacity, parameterIds } = eventSab;
      if (this._eventSabReady) {
        this._eventWriter.setParameterIds(parameterIds);
        this._eventReader.setParameterIds(parameterIds);
        return;
      }
      this._mainToAudioEventSab = WamEventRingBuffer.getStorageForEventCapacity(RingBuffer, eventCapacity);
      this._audioToMainEventSab = WamEventRingBuffer.getStorageForEventCapacity(RingBuffer, eventCapacity);
      this._eventWriter = new WamEventRingBuffer(RingBuffer, this._mainToAudioEventSab, parameterIds);
      this._eventReader = new WamEventRingBuffer(RingBuffer, this._audioToMainEventSab, parameterIds);
      const request = "initialize/eventSab";
      const id = this._generateMessageId();
      new Promise((resolve, reject) => {
        this._pendingResponses[id] = resolve;
        this.port.postMessage({
          id,
          request,
          content: {
            mainToAudioEventSab: this._mainToAudioEventSab,
            audioToMainEventSab: this._audioToMainEventSab
          }
        });
      }).then((resolved) => {
        this._eventSabReady = true;
        this._audioToMainInterval = setInterval(() => {
          const events = this._eventReader.read();
          events.forEach((e) => {
            this._onEvent(e);
          });
        }, 100);
      });
    } else if (event)
      this._onEvent(event);
  }
  _onEvent(event) {
    const { type } = event;
    this.dispatchEvent(new CustomEvent(type, {
      bubbles: true,
      detail: event
    }));
  }
};

// compresor/descriptor.json
var descriptor_default = {
  identifier: "org.wedwed.pizarrita.compresor",
  name: "Compresor y limitador",
  vendor: "Pizarrita",
  description: "Compresor con rodilla blanda y mezcla, y limitador con techo que mira 5 ms hacia adelante",
  version: "0.1.0",
  apiVersion: "2.0.0",
  thumbnail: "",
  keywords: ["effect", "compressor", "limiter", "dynamics"],
  isInstrument: false,
  website: "",
  hasAudioInput: true,
  hasAudioOutput: true,
  hasAutomationInput: true,
  hasAutomationOutput: false,
  hasMidiInput: false,
  hasMidiOutput: false,
  hasMpeInput: false,
  hasMpeOutput: false,
  hasOscInput: false,
  hasOscOutput: false,
  hasSysexInput: false,
  hasSysexOutput: false
};

// compresor/procesador.js
function dspCompresor(moduleId) {
  const ambito = globalThis.webAudioModules.getModuleScope(moduleId);
  const K = Math.LN10 / 20;
  const aDb = (x) => 20 * Math.log10(x + 1e-9);
  const deDb = (d) => Math.exp(d * K);
  ambito.pzCrearCompresor = (fm) => {
    let sosten = 0;
    let red = 0;
    const ATRASO = Math.max(1, Math.round(5e-3 * fm));
    const VENTANA = ATRASO + 1;
    const lineaI = new Float32Array(VENTANA);
    const lineaD = new Float32Array(VENTANA);
    let pos = 0;
    const C = VENTANA + 1;
    const colaV = new Float64Array(C);
    const colaN = new Float64Array(C);
    let cab = 0;
    let fin = 0;
    let cuantos = 0;
    const cajon = new Float64Array(VENTANA).fill(1);
    let suma = VENTANA;
    let posCajon = 0;
    let env = 1;
    let n = 0;
    let limAntes = false;
    let picoE = 0;
    let picoS = 0;
    let maxRed = 0;
    let minLim = 1;
    let recortes = 0;
    const reiniciarLimitador = () => {
      lineaI.fill(0);
      lineaD.fill(0);
      pos = 0;
      cab = 0;
      fin = 0;
      cuantos = 0;
      cajon.fill(1);
      suma = VENTANA;
      posCajon = 0;
      env = 1;
      n = 0;
    };
    const procesar = (eI, eD, sI, sD, desde, hasta, p) => {
      const cA = Math.exp(-1 / (1e-3 * Math.max(0.05, p.ataque) * fm));
      const cR = Math.exp(-1 / (1e-3 * Math.max(1, p.relajacion) * fm));
      const T = p.umbral;
      const W = Math.max(0, p.rodilla);
      const pend = 1 - 1 / Math.max(1, p.razon);
      const gan = deDb(p.ganancia);
      const mz = Math.min(1, Math.max(0, p.mezcla / 100));
      const techo = deDb(p.techo);
      const cLib = Math.exp(-1 / (0.1 * fm));
      if (p.lim && !limAntes) reiniciarLimitador();
      limAntes = !!p.lim;
      for (let i = desde; i < hasta; i++) {
        const l = eI[i];
        const r = eD[i];
        const al = l < 0 ? -l : l;
        const ar = r < 0 ? -r : r;
        const pico = al > ar ? al : ar;
        if (pico > picoE) picoE = pico;
        let yl = l;
        let yr = r;
        if (p.comp) {
          const sobre = aDb(pico) - T;
          let obj;
          if (2 * sobre <= -W) obj = 0;
          else if (2 * sobre < W) {
            const t2 = sobre + W / 2;
            obj = pend * t2 * t2 / (2 * W);
          } else obj = pend * sobre;
          const baja = cR * sosten + (1 - cR) * obj;
          sosten = obj > baja ? obj : baja;
          red = cA * red + (1 - cA) * sosten;
          if (red < 1e-7) red = 0;
          if (sosten < 1e-7) sosten = 0;
          if (red > maxRed) maxRed = red;
          const g = 1 - mz + mz * deDb(-red) * gan;
          yl = l * g;
          yr = r * g;
        }
        if (p.lim) {
          const bl = yl < 0 ? -yl : yl;
          const br = yr < 0 ? -yr : yr;
          const pico2 = bl > br ? bl : br;
          const nec = pico2 > techo ? techo / pico2 : 1;
          const sube = 1 - (1 - env) * cLib;
          env = nec < sube ? nec : sube;
          while (cuantos > 0 && colaV[(fin - 1 + C) % C] >= env) {
            fin = (fin - 1 + C) % C;
            cuantos--;
          }
          colaV[fin] = env;
          colaN[fin] = n;
          fin = (fin + 1) % C;
          cuantos++;
          while (colaN[cab] <= n - VENTANA) {
            cab = (cab + 1) % C;
            cuantos--;
          }
          const minimo = colaV[cab];
          n++;
          suma += minimo - cajon[posCajon];
          cajon[posCajon] = minimo;
          posCajon = (posCajon + 1) % VENTANA;
          const g2 = suma / VENTANA;
          if (g2 < minLim) minLim = g2;
          lineaI[pos] = yl;
          lineaD[pos] = yr;
          pos = (pos + 1) % VENTANA;
          yl = lineaI[pos] * g2;
          yr = lineaD[pos] * g2;
          const tope = techo * 1.000001;
          if (yl > tope || yl < -tope || yr > tope || yr < -tope) recortes++;
          if (yl > techo) yl = techo;
          else if (yl < -techo) yl = -techo;
          if (yr > techo) yr = techo;
          else if (yr < -techo) yr = -techo;
        }
        const cl = yl < 0 ? -yl : yl;
        const cr = yr < 0 ? -yr : yr;
        if (cl > picoS) picoS = cl;
        if (cr > picoS) picoS = cr;
        sI[i] = yl;
        sD[i] = yr;
      }
    };
    const medidas = () => {
      const m = { e: aDb(picoE), s: aDb(picoS), r: -maxRed, l: aDb(minLim), recortes };
      picoE = 0;
      picoS = 0;
      maxRed = red;
      minLim = 1;
      recortes = 0;
      return m;
    };
    return { procesar, medidas, atraso: ATRASO };
  };
}
function procesadorCompresor(moduleId) {
  const ambito = globalThis.webAudioModules.getModuleScope(moduleId);
  const { WamProcessor, WamParameterInfo, pzCrearCompresor } = ambito;
  class ProcesadorCompresor extends WamProcessor {
    constructor(options) {
      super(options);
      this._dsp = pzCrearCompresor(sampleRate);
      this._cero = new Float32Array(128);
      this._medir = false;
      this._cuenta = 0;
      this._p = {};
    }
    _generateWamParameterInfo() {
      const f = (id, label, defaultValue, minValue, maxValue, units) => new WamParameterInfo(id, { type: "float", label, defaultValue, minValue, maxValue, units });
      const b = (id, label, defaultValue) => new WamParameterInfo(id, { type: "boolean", label, defaultValue });
      return {
        comp: b("comp", "Compresor", 1),
        umbral: f("umbral", "Umbral", -18, -60, 0, "dB"),
        razon: f("razon", "Raz\xF3n", 4, 1, 20, ": 1"),
        ataque: f("ataque", "Ataque", 10, 0.1, 250, "ms"),
        relajacion: f("relajacion", "Relajaci\xF3n", 120, 10, 2e3, "ms"),
        rodilla: f("rodilla", "Rodilla", 6, 0, 24, "dB"),
        ganancia: f("ganancia", "Ganancia", 0, -12, 24, "dB"),
        mezcla: f("mezcla", "Mezcla", 100, 0, 100, "%"),
        lim: b("lim", "Limitador", 0),
        techo: f("techo", "Techo", -0.3, -12, 0, "dB")
      };
    }
    // Además de lo del SDK: la carátula pide (o deja de pedir) las medidas.
    async _onMessage(message) {
      if (message.data && message.data.pz === "medir") {
        this._medir = !!message.data.si;
        this._dsp.medidas();
        return;
      }
      return super._onMessage(message);
    }
    _process(desde, hasta, inputs, outputs) {
      const sal = outputs[0];
      if (!sal || !sal.length) return;
      const ent = inputs[0];
      const eI = ent && ent[0] ? ent[0] : this._cero;
      const eD = ent && ent[1] ? ent[1] : eI;
      const I = this._parameterInterpolators;
      const p = this._p;
      p.comp = I.comp.values[desde] >= 0.5;
      p.umbral = I.umbral.values[desde];
      p.razon = I.razon.values[desde];
      p.ataque = I.ataque.values[desde];
      p.relajacion = I.relajacion.values[desde];
      p.rodilla = I.rodilla.values[desde];
      p.ganancia = I.ganancia.values[desde];
      p.mezcla = I.mezcla.values[desde];
      p.lim = I.lim.values[desde] >= 0.5;
      p.techo = I.techo.values[desde];
      this._dsp.procesar(eI, eD, sal[0], sal[1] || sal[0], desde, hasta, p);
      this._compensationDelay = p.lim ? this._dsp.atraso / sampleRate : 0;
      this._cuenta += hasta - desde;
      if (this._cuenta >= 1024) {
        this._cuenta = 0;
        if (this._medir) this.port.postMessage({ pz: "medidor", ...this._dsp.medidas() });
      }
    }
  }
  try {
    registerProcessor(moduleId, ProcesadorCompresor);
  } catch (e) {
  }
}

// comun/controles.js
var POR_DEFECTO = {
  fondo: "#dcdcdc",
  tinta: "#1a1a1a",
  tinta2: "#5c5c5c",
  borde: "#9a9a9a",
  pantalla: "#f4f4f4",
  acento: "#ff8a00",
  nivel: "#4a9a4a",
  reduccion: "#d23c3c",
  traza: "#bdbdbd"
};
var v = (nombre) => `var(--pzw-${nombre},${POR_DEFECTO[nombre]})`;
var PUESTAS = /* @__PURE__ */ new WeakMap();
function leerColor(texto) {
  const m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)$/.exec(String(texto || "").trim());
  if (!m) return null;
  const a = m[4] === void 0 ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
  return [Number(m[1]), Number(m[2]), Number(m[3]), a];
}
var mezclar = (a, b, t2) => `rgb(${[0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t2)).join(",")})`;
var brillo = (c) => {
  const f = (x) => {
    const u = x / 255;
    return u <= 0.03928 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
};
function deducirColores(tinta, fondo) {
  const lt = brillo(tinta);
  const lf = brillo(fondo);
  if ((Math.max(lt, lf) + 0.05) / (Math.min(lt, lf) + 0.05) < 3) return null;
  const claro = lf > lt;
  return {
    fondo: mezclar(fondo, fondo, 0),
    tinta: mezclar(tinta, tinta, 0),
    tinta2: mezclar(tinta, fondo, 0.38),
    borde: mezclar(tinta, fondo, 0.6),
    pantalla: claro ? mezclar(fondo, [255, 255, 255], 0.55) : mezclar(fondo, [0, 0, 0], 0.35),
    traza: mezclar(tinta, fondo, 0.72)
  };
}
function seguirTema(caja) {
  const padre = caja.parentElement;
  if (!padre) return;
  const antes = PUESTAS.get(caja) || {};
  for (const k of Object.keys(antes)) caja.style.removeProperty(k);
  const cs = getComputedStyle(padre);
  let fondo = null;
  for (let e = padre; e && !fondo; e = e.parentElement) {
    const c = leerColor(getComputedStyle(e).backgroundColor);
    if (c && c[3] > 0.5) fondo = c;
  }
  const tinta = leerColor(cs.color);
  const nuevas = {};
  const poner = (nombre, valor) => {
    if (!valor || cs.getPropertyValue("--pzw-" + nombre).trim()) return;
    nuevas["--pzw-" + nombre] = valor;
  };
  const deducidos = fondo && tinta ? deducirColores(tinta, fondo) : null;
  if (deducidos) for (const k of Object.keys(deducidos)) poner(k, deducidos[k]);
  const acento = cs.getPropertyValue("--pz-acento").trim() || (cs.accentColor && cs.accentColor !== "auto" ? cs.accentColor : "");
  poner("acento", acento);
  if (cs.fontFamily) poner("letra", cs.fontFamily);
  for (const k of Object.keys(nuevas)) caja.style.setProperty(k, nuevas[k]);
  PUESTAS.set(caja, nuevas);
}
function coloresDe(el2) {
  const seguir = () => {
    try {
      seguirTema(el2);
    } catch (e) {
    }
  };
  if (el2.parentElement) seguir();
  else setTimeout(seguir, 60);
  const cs = getComputedStyle(el2);
  const c = {};
  for (const k of Object.keys(POR_DEFECTO)) c[k] = cs.getPropertyValue("--pzw-" + k).trim() || POR_DEFECTO[k];
  return c;
}
var menos = (texto) => String(texto).replace("-", "\u2212");
var numero = (x, decimales) => menos(x.toFixed(decimales));
function el(etiqueta, css, texto) {
  const e = document.createElement(etiqueta);
  if (css) e.style.cssText = css;
  if (texto !== void 0) e.textContent = texto;
  return e;
}
function lienzo(ancho, alto) {
  const c = document.createElement("canvas");
  const d = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  c.width = Math.round(ancho * d);
  c.height = Math.round(alto * d);
  c.style.cssText = `width:${ancho}px;height:${alto}px;display:block;flex:none;`;
  const g = c.getContext("2d");
  g.scale(d, d);
  return { c, g, ancho, alto };
}
function arrastrable(e, { leer, escribir, porDefecto, alAgarrar }) {
  e.tabIndex = 0;
  e.style.touchAction = "none";
  e.style.cursor = "ns-resize";
  e.style.outline = "none";
  let y0 = 0;
  let t0 = 0;
  let agarrado = false;
  const fijar = (t2) => escribir(Math.min(1, Math.max(0, t2)));
  e.addEventListener("pointerdown", (ev) => {
    if (ev.button !== 0) return;
    agarrado = true;
    alAgarrar(true);
    y0 = ev.clientY;
    t0 = leer();
    try {
      e.setPointerCapture(ev.pointerId);
    } catch (err) {
    }
    ev.preventDefault();
    e.focus();
  });
  e.addEventListener("pointermove", (ev) => {
    if (!agarrado) return;
    fijar(t0 + (y0 - ev.clientY) / (ev.shiftKey ? 800 : 160));
  });
  const soltar = () => {
    if (!agarrado) return;
    agarrado = false;
    alAgarrar(false);
  };
  e.addEventListener("pointerup", soltar);
  e.addEventListener("pointercancel", soltar);
  e.addEventListener("dblclick", () => fijar(porDefecto()));
  e.addEventListener(
    "wheel",
    (ev) => {
      ev.preventDefault();
      fijar(leer() + (ev.deltaY < 0 ? 1 : -1) * (ev.shiftKey ? 4e-3 : 0.02));
    },
    { passive: false }
  );
  e.addEventListener("keydown", (ev) => {
    const paso = ev.shiftKey ? 2e-3 : 0.01;
    if (ev.key === "ArrowUp" || ev.key === "ArrowRight") fijar(leer() + paso);
    else if (ev.key === "ArrowDown" || ev.key === "ArrowLeft") fijar(leer() - paso);
    else return;
    ev.preventDefault();
  });
}
function escala({ min, max, paso, log }) {
  const aT = (x) => log ? Math.log(x / min) / Math.log(max / min) : (x - min) / (max - min);
  const deT = (t2) => {
    const x = log ? min * (max / min) ** t2 : min + t2 * (max - min);
    const p = log ? Math.min(paso, 10 ** Math.floor(Math.log10(Math.max(x, min) / 20))) || paso : paso;
    return Math.min(max, Math.max(min, Math.round(x / p) * p));
  };
  return { aT, deT };
}
function perilla(o) {
  const { aT, deT } = escala(o);
  let valor = o.porDefecto;
  let agarrada = false;
  const NS = "http://www.w3.org/2000/svg";
  const caja = el("div", "display:flex;flex-direction:column;align-items:center;gap:1px;min-width:0;");
  const nombre = el("div", `color:${v("tinta2")};font-size:11px;white-space:nowrap;`, o.nombre);
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 40 40");
  svg.setAttribute("width", "40");
  svg.setAttribute("height", "40");
  svg.setAttribute("role", "slider");
  svg.setAttribute("aria-label", o.nombre);
  const trazo = (css) => {
    const p = document.createElementNS(NS, "path");
    p.setAttribute("fill", "none");
    p.setAttribute("stroke-width", "3");
    p.style.cssText = css;
    svg.append(p);
    return p;
  };
  const R = 15;
  const punto = (grados) => {
    const a = grados * Math.PI / 180;
    return [20 + R * Math.cos(a), 20 + R * Math.sin(a)];
  };
  const arco = (t2) => {
    const [x0, y0] = punto(135);
    const [x1, y1] = punto(135 + 270 * t2);
    return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${R} ${R} 0 ${270 * t2 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  };
  trazo(`stroke:${v("traza")}`).setAttribute("d", arco(1));
  const lleno = trazo(`stroke:${v("acento")}`);
  const aguja = document.createElementNS(NS, "line");
  aguja.setAttribute("x1", "20");
  aguja.setAttribute("y1", "20");
  aguja.setAttribute("stroke-width", "2");
  aguja.style.cssText = `stroke:${v("tinta")}`;
  svg.append(aguja);
  const texto = el("div", "font-size:11px;white-space:nowrap;font-variant-numeric:tabular-nums;");
  const pintar = () => {
    const t2 = Math.min(1, Math.max(0, aT(valor)));
    lleno.setAttribute("d", t2 > 1e-3 ? arco(t2) : "");
    const [x, y] = punto(135 + 270 * t2);
    aguja.setAttribute("x2", x.toFixed(2));
    aguja.setAttribute("y2", y.toFixed(2));
    texto.textContent = o.formato(valor);
    svg.setAttribute("aria-valuetext", texto.textContent);
  };
  arrastrable(svg, {
    leer: () => aT(valor),
    escribir: (t2) => {
      const nuevo = deT(t2);
      if (nuevo === valor) return;
      valor = nuevo;
      pintar();
      o.alCambiar(valor);
    },
    porDefecto: () => aT(o.porDefecto),
    alAgarrar: (si) => {
      agarrada = si;
    }
  });
  svg.addEventListener("focus", () => svg.style.filter = "brightness(0.85)");
  svg.addEventListener("blur", () => svg.style.filter = "");
  caja.append(nombre, svg, texto);
  pintar();
  return {
    el: caja,
    poner: (x) => {
      valor = x;
      pintar();
    },
    agarrada: () => agarrada
  };
}
function casilla(o) {
  const { aT, deT } = escala(o);
  let valor = o.porDefecto;
  let agarrada = false;
  const caja = el(
    "span",
    `display:inline-block;min-width:54px;text-align:center;padding:1px 6px;box-sizing:border-box;background:${v("pantalla")};border:1px solid ${v("borde")};font-variant-numeric:tabular-nums;user-select:none;`
  );
  caja.setAttribute("role", "slider");
  caja.setAttribute("aria-label", o.nombre);
  const pintar = () => {
    caja.textContent = o.formato(valor);
  };
  arrastrable(caja, {
    leer: () => aT(valor),
    escribir: (t2) => {
      const nuevo = deT(t2);
      if (nuevo === valor) return;
      valor = nuevo;
      pintar();
      o.alCambiar(valor);
    },
    porDefecto: () => aT(o.porDefecto),
    alAgarrar: (si) => {
      agarrada = si;
    }
  });
  pintar();
  return {
    el: caja,
    poner: (x) => {
      valor = x;
      pintar();
    },
    agarrada: () => agarrada
  };
}
function interruptor(o) {
  let puesto = !!o.porDefecto;
  const b = el(
    "button",
    `display:inline-flex;align-items:center;gap:7px;padding:0;border:0;background:none;color:inherit;font:inherit;font-weight:bold;font-size:13px;cursor:pointer;`
  );
  b.type = "button";
  b.setAttribute("role", "switch");
  const luz = el("span", `width:12px;height:12px;box-sizing:border-box;border:1px solid ${v("borde")};flex:none;`);
  b.append(luz, o.nombre);
  const pintar = () => {
    luz.style.background = puesto ? v("acento") : v("pantalla");
    b.setAttribute("aria-checked", String(puesto));
  };
  b.addEventListener("click", () => {
    puesto = !puesto;
    pintar();
    o.alCambiar(puesto);
  });
  pintar();
  return {
    el: b,
    poner: (x) => {
      puesto = !!x;
      pintar();
    },
    agarrada: () => false,
    puesto: () => puesto
  };
}

// comun/idiomas.js
var IDIOMAS = ["EN", "PT", "FR", "EU", "RU", "JA", "KO", "ZH", "TH"];
var TEXTOS = {
  // --- los plugins
  Filtro: ["Filter", "Filtro", "Filtre", "Iragazkia", "\u0424\u0438\u043B\u044C\u0442\u0440", "\u30D5\u30A3\u30EB\u30BF\u30FC", "\uD544\uD130", "\u6EE4\u6CE2\u5668", "\u0E1F\u0E34\u0E25\u0E40\u0E15\u0E2D\u0E23\u0E4C"],
  Chorus: ["Chorus", "Chorus", "Chorus", "Chorus", "\u0425\u043E\u0440\u0443\u0441", "\u30B3\u30FC\u30E9\u30B9", "\uCF54\uB7EC\uC2A4", "\u5408\u5531", "\u0E04\u0E2D\u0E23\u0E31\u0E2A"],
  Flanger: ["Flanger", "Flanger", "Flanger", "Flanger", "\u0424\u043B\u044D\u043D\u0434\u0436\u0435\u0440", "\u30D5\u30E9\u30F3\u30B8\u30E3\u30FC", "\uD50C\uB79C\uC800", "\u9576\u8FB9", "\u0E41\u0E1F\u0E25\u0E19\u0E40\u0E08\u0E2D\u0E23\u0E4C"],
  Phaser: ["Phaser", "Phaser", "Phaser", "Phaser", "\u0424\u044D\u0439\u0437\u0435\u0440", "\u30D5\u30A7\u30A4\u30B6\u30FC", "\uD398\uC774\uC800", "\u79FB\u76F8", "\u0E40\u0E1F\u0E2A\u0E40\u0E0B\u0E2D\u0E23\u0E4C"],
  Tr\u00E9molo: ["Tremolo", "Tr\xEAmolo", "Tr\xE9molo", "Tremoloa", "\u0422\u0440\u0435\u043C\u043E\u043B\u043E", "\u30C8\u30EC\u30E2\u30ED", "\uD2B8\uB808\uBAB0\uB85C", "\u98A4\u97F3", "\u0E40\u0E17\u0E23\u0E42\u0E21\u0E42\u0E25"],
  Ecualizador: ["Equalizer", "Equalizador", "\xC9galiseur", "Ekualizadorea", "\u042D\u043A\u0432\u0430\u043B\u0430\u0439\u0437\u0435\u0440", "\u30A4\u30B3\u30E9\u30A4\u30B6\u30FC", "\uC774\uD004\uB77C\uC774\uC800", "\u5747\u8861\u5668", "\u0E2D\u0E35\u0E04\u0E27\u0E2D\u0E44\u0E25\u0E40\u0E0B\u0E2D\u0E23\u0E4C"],
  Compresor: ["Compressor", "Compressor", "Compresseur", "Konpresorea", "\u041A\u043E\u043C\u043F\u0440\u0435\u0441\u0441\u043E\u0440", "\u30B3\u30F3\u30D7\u30EC\u30C3\u30B5\u30FC", "\uCEF4\uD504\uB808\uC11C", "\u538B\u7F29\u5668", "\u0E04\u0E2D\u0E21\u0E40\u0E1E\u0E23\u0E2A\u0E40\u0E0B\u0E2D\u0E23\u0E4C"],
  Limitador: ["Limiter", "Limitador", "Limiteur", "Mugatzailea", "\u041B\u0438\u043C\u0438\u0442\u0435\u0440", "\u30EA\u30DF\u30C3\u30BF\u30FC", "\uB9AC\uBBF8\uD130", "\u9650\u5236\u5668", "\u0E25\u0E34\u0E21\u0E34\u0E15\u0E40\u0E15\u0E2D\u0E23\u0E4C"],
  // --- los parámetros
  Tipo: ["Type", "Tipo", "Type", "Mota", "\u0422\u0438\u043F", "\u30BF\u30A4\u30D7", "\uC720\uD615", "\u7C7B\u578B", "\u0E1B\u0E23\u0E30\u0E40\u0E20\u0E17"],
  Frecuencia: ["Frequency", "Frequ\xEAncia", "Fr\xE9quence", "Maiztasuna", "\u0427\u0430\u0441\u0442\u043E\u0442\u0430", "\u5468\u6CE2\u6570", "\uC8FC\uD30C\uC218", "\u9891\u7387", "\u0E04\u0E27\u0E32\u0E21\u0E16\u0E35\u0E48"],
  Resonancia: ["Resonance", "Resson\xE2ncia", "R\xE9sonance", "Erresonantzia", "\u0420\u0435\u0437\u043E\u043D\u0430\u043D\u0441", "\u30EC\u30BE\u30CA\u30F3\u30B9", "\uB808\uC870\uB10C\uC2A4", "\u5171\u632F", "\u0E40\u0E23\u0E42\u0E0B\u0E41\u0E19\u0E19\u0E0B\u0E4C"],
  Pendiente: ["Slope", "Inclina\xE7\xE3o", "Pente", "Malda", "\u041A\u0440\u0443\u0442\u0438\u0437\u043D\u0430", "\u30B9\u30ED\u30FC\u30D7", "\uAE30\uC6B8\uAE30", "\u659C\u7387", "\u0E04\u0E27\u0E32\u0E21\u0E0A\u0E31\u0E19"],
  Velocidad: ["Rate", "Velocidade", "Vitesse", "Abiadura", "\u0421\u043A\u043E\u0440\u043E\u0441\u0442\u044C", "\u901F\u3055", "\uC18D\uB3C4", "\u901F\u5EA6", "\u0E04\u0E27\u0E32\u0E21\u0E40\u0E23\u0E47\u0E27"],
  Vaiv\u00E9n: ["Sweep", "Oscila\xE7\xE3o", "Balayage", "Kulunka", "\u041A\u0430\u0447\u0430\u043D\u0438\u0435", "\u63FA\u308C\u5E45", "\uD754\uB4E4\uB9BC", "\u6446\u52A8", "\u0E01\u0E32\u0E23\u0E41\u0E01\u0E27\u0E48\u0E07"],
  Mezcla: ["Mix", "Mistura", "M\xE9lange", "Nahasketa", "\u0421\u043C\u0435\u0441\u044C", "\u30DF\u30C3\u30AF\u30B9", "\uBBF9\uC2A4", "\u6DF7\u5408", "\u0E21\u0E34\u0E01\u0E0B\u0E4C"],
  Retardo: ["Delay", "Atraso", "Retard", "Atzerapena", "\u0417\u0430\u0434\u0435\u0440\u0436\u043A\u0430", "\u30C7\u30A3\u30EC\u30A4", "\uB51C\uB808\uC774", "\u5EF6\u8FDF", "\u0E14\u0E35\u0E40\u0E25\u0E22\u0E4C"],
  Realimentaci\u00F3n: ["Feedback", "Realimenta\xE7\xE3o", "R\xE9injection", "Atzeraelikadura", "\u041E\u0431\u0440\u0430\u0442\u043D\u0430\u044F \u0441\u0432\u044F\u0437\u044C", "\u30D5\u30A3\u30FC\u30C9\u30D0\u30C3\u30AF", "\uD53C\uB4DC\uBC31", "\u53CD\u9988", "\u0E1F\u0E35\u0E14\u0E41\u0E1A\u0E47\u0E01"],
  Ancho: ["Width", "Largura", "Largeur", "Zabalera", "\u0428\u0438\u0440\u0438\u043D\u0430", "\u5E45", "\uD3ED", "\u5BBD\u5EA6", "\u0E04\u0E27\u0E32\u0E21\u0E01\u0E27\u0E49\u0E32\u0E07"],
  Centro: ["Center", "Centro", "Centre", "Erdigunea", "\u0426\u0435\u043D\u0442\u0440", "\u4E2D\u5FC3", "\uC911\uC2EC", "\u4E2D\u5FC3", "\u0E08\u0E38\u0E14\u0E01\u0E25\u0E32\u0E07"],
  Etapas: ["Stages", "Est\xE1gios", "\xC9tages", "Etapak", "\u0421\u0442\u0443\u043F\u0435\u043D\u0438", "\u6BB5\u6570", "\uB2E8\uACC4", "\u7EA7\u6570", "\u0E08\u0E33\u0E19\u0E27\u0E19\u0E02\u0E31\u0E49\u0E19"],
  Profundidad: ["Depth", "Profundidade", "Profondeur", "Sakonera", "\u0413\u043B\u0443\u0431\u0438\u043D\u0430", "\u6DF1\u3055", "\uAE4A\uC774", "\u6DF1\u5EA6", "\u0E04\u0E27\u0E32\u0E21\u0E25\u0E36\u0E01"],
  Forma: ["Shape", "Forma", "Forme", "Forma", "\u0424\u043E\u0440\u043C\u0430", "\u6CE2\u5F62", "\uD30C\uD615", "\u6CE2\u5F62", "\u0E23\u0E39\u0E1B\u0E04\u0E25\u0E37\u0E48\u0E19"],
  "Entre orejas": ["Between ears", "Entre ouvidos", "Entre les oreilles", "Belarrien artean", "\u041C\u0435\u0436\u0434\u0443 \u0443\u0448\u0430\u043C\u0438", "\u5DE6\u53F3\u306E\u4F4D\u76F8", "\uC88C\uC6B0 \uC704\uC0C1", "\u5DE6\u53F3\u76F8\u4F4D", "\u0E23\u0E30\u0E2B\u0E27\u0E48\u0E32\u0E07\u0E2B\u0E39\u0E0B\u0E49\u0E32\u0E22\u0E02\u0E27\u0E32"],
  Umbral: ["Threshold", "Limiar", "Seuil", "Atalasea", "\u041F\u043E\u0440\u043E\u0433", "\u30B9\u30EC\u30C3\u30B7\u30E7\u30EB\u30C9", "\uC2A4\uB808\uC204\uB4DC", "\u9608\u503C", "\u0E40\u0E17\u0E23\u0E0A\u0E42\u0E2E\u0E25\u0E14\u0E4C"],
  Raz\u00F3n: ["Ratio", "Raz\xE3o", "Ratio", "Erlazioa", "\u0421\u043E\u043E\u0442\u043D\u043E\u0448\u0435\u043D\u0438\u0435", "\u30EC\u30B7\u30AA", "\uBE44\uC728", "\u6BD4\u7387", "\u0E2D\u0E31\u0E15\u0E23\u0E32\u0E2A\u0E48\u0E27\u0E19"],
  Ataque: ["Attack", "Ataque", "Attaque", "Erasoa", "\u0410\u0442\u0430\u043A\u0430", "\u30A2\u30BF\u30C3\u30AF", "\uC5B4\uD0DD", "\u542F\u52A8", "\u0E41\u0E2D\u0E17\u0E41\u0E17\u0E04"],
  Relajaci\u00F3n: ["Release", "Libera\xE7\xE3o", "Rel\xE2chement", "Askatzea", "\u0412\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435", "\u30EA\u30EA\u30FC\u30B9", "\uB9B4\uB9AC\uC2A4", "\u91CA\u653E", "\u0E23\u0E35\u0E25\u0E35\u0E2A"],
  Rodilla: ["Knee", "Joelho", "Genou", "Belauna", "\u041A\u043E\u043B\u0435\u043D\u043E", "\u30CB\u30FC", "\uB2C8", "\u62D0\u70B9", "\u0E19\u0E35"],
  Ganancia: ["Gain", "Ganho", "Gain", "Irabazia", "\u0423\u0441\u0438\u043B\u0435\u043D\u0438\u0435", "\u30B2\u30A4\u30F3", "\uAC8C\uC778", "\u589E\u76CA", "\u0E40\u0E01\u0E19"],
  Techo: ["Ceiling", "Teto", "Plafond", "Sabaia", "\u041F\u043E\u0442\u043E\u043B\u043E\u043A", "\u30B7\u30FC\u30EA\u30F3\u30B0", "\uC2E4\uB9C1", "\u4E0A\u9650", "\u0E40\u0E1E\u0E14\u0E32\u0E19"],
  Salida: ["Output", "Sa\xEDda", "Sortie", "Irteera", "\u0412\u044B\u0445\u043E\u0434", "\u51FA\u529B", "\uCD9C\uB825", "\u8F93\u51FA", "\u0E40\u0E2D\u0E32\u0E15\u0E4C\u0E1E\u0E38\u0E15"],
  Encendida: ["On", "Ligada", "Activ\xE9e", "Piztuta", "\u0412\u043A\u043B\u044E\u0447\u0435\u043D\u0430", "\u30AA\u30F3", "\uCF1C\uC9D0", "\u5F00\u542F", "\u0E40\u0E1B\u0E34\u0E14"],
  "Tipo de banda": ["Band type", "Tipo de banda", "Type de bande", "Banda mota", "\u0422\u0438\u043F \u043F\u043E\u043B\u043E\u0441\u044B", "\u30D0\u30F3\u30C9\u306E\u7A2E\u985E", "\uBC34\uB4DC \uC720\uD615", "\u9891\u6BB5\u7C7B\u578B", "\u0E1B\u0E23\u0E30\u0E40\u0E20\u0E17\u0E41\u0E1A\u0E19\u0E14\u0E4C"],
  "Pendiente del corte": ["Cut slope", "Inclina\xE7\xE3o do corte", "Pente de coupure", "Ebakiaren malda", "\u041A\u0440\u0443\u0442\u0438\u0437\u043D\u0430 \u0441\u0440\u0435\u0437\u0430", "\u30AB\u30C3\u30C8\u306E\u30B9\u30ED\u30FC\u30D7", "\uCEF7 \uAE30\uC6B8\uAE30", "\u5207\u9664\u659C\u7387", "\u0E04\u0E27\u0E32\u0E21\u0E0A\u0E31\u0E19\u0E02\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E15\u0E31\u0E14"],
  Banda: ["Band", "Banda", "Bande", "Banda", "\u041F\u043E\u043B\u043E\u0441\u0430", "\u30D0\u30F3\u30C9", "\uBC34\uB4DC", "\u9891\u6BB5", "\u0E41\u0E1A\u0E19\u0E14\u0E4C"],
  tipo: ["type", "tipo", "type", "mota", "\u0442\u0438\u043F", "\u7A2E\u985E", "\uC720\uD615", "\u7C7B\u578B", "\u0E1B\u0E23\u0E30\u0E40\u0E20\u0E17"],
  frecuencia: ["frequency", "frequ\xEAncia", "fr\xE9quence", "maiztasuna", "\u0447\u0430\u0441\u0442\u043E\u0442\u0430", "\u5468\u6CE2\u6570", "\uC8FC\uD30C\uC218", "\u9891\u7387", "\u0E04\u0E27\u0E32\u0E21\u0E16\u0E35\u0E48"],
  ganancia: ["gain", "ganho", "gain", "irabazia", "\u0443\u0441\u0438\u043B\u0435\u043D\u0438\u0435", "\u30B2\u30A4\u30F3", "\uAC8C\uC778", "\u589E\u76CA", "\u0E40\u0E01\u0E19"],
  "pendiente del corte": ["cut slope", "inclina\xE7\xE3o do corte", "pente de coupure", "ebakiaren malda", "\u043A\u0440\u0443\u0442\u0438\u0437\u043D\u0430 \u0441\u0440\u0435\u0437\u0430", "\u30AB\u30C3\u30C8\u306E\u30B9\u30ED\u30FC\u30D7", "\uCEF7 \uAE30\uC6B8\uAE30", "\u5207\u9664\u659C\u7387", "\u0E04\u0E27\u0E32\u0E21\u0E0A\u0E31\u0E19\u0E02\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E15\u0E31\u0E14"],
  // --- las opciones
  "Pasa bajos": ["Low pass", "Passa-baixas", "Passe-bas", "Behe-pasakoa", "\u041D\u0438\u0436\u043D\u0438\u0445 \u0447\u0430\u0441\u0442\u043E\u0442", "\u30ED\u30FC\u30D1\u30B9", "\uB85C\uC6B0\uD328\uC2A4", "\u4F4E\u901A", "\u0E42\u0E25\u0E27\u0E4C\u0E1E\u0E32\u0E2A"],
  "Pasa altos": ["High pass", "Passa-altas", "Passe-haut", "Goi-pasakoa", "\u0412\u0435\u0440\u0445\u043D\u0438\u0445 \u0447\u0430\u0441\u0442\u043E\u0442", "\u30CF\u30A4\u30D1\u30B9", "\uD558\uC774\uD328\uC2A4", "\u9AD8\u901A", "\u0E44\u0E2E\u0E1E\u0E32\u0E2A"],
  "Pasa banda": ["Band pass", "Passa-banda", "Passe-bande", "Banda-pasakoa", "\u041F\u043E\u043B\u043E\u0441\u043E\u0432\u043E\u0439", "\u30D0\u30F3\u30C9\u30D1\u30B9", "\uBC34\uB4DC\uD328\uC2A4", "\u5E26\u901A", "\u0E41\u0E1A\u0E19\u0E14\u0E4C\u0E1E\u0E32\u0E2A"],
  Muesca: ["Notch", "Rejeita-banda", "Coupe-bande", "Koska", "\u0420\u0435\u0436\u0435\u043A\u0442\u043E\u0440\u043D\u044B\u0439", "\u30CE\u30C3\u30C1", "\uB178\uCE58", "\u9677\u6CE2", "\u0E19\u0E47\u0E2D\u0E15\u0E0A\u0E4C"],
  Campana: ["Bell", "Sino", "Cloche", "Kanpaia", "\u041A\u043E\u043B\u043E\u043A\u043E\u043B", "\u30D9\u30EB", "\uBCA8", "\u949F\u5F62", "\u0E23\u0E30\u0E06\u0E31\u0E07"],
  "Repisa baja": ["Low shelf", "Prateleira baixa", "Plateau grave", "Apal baxua", "\u041F\u043E\u043B\u043A\u0430 \u041D\u0427", "\u30ED\u30FC\u30B7\u30A7\u30EB\u30D5", "\uB85C\uC6B0 \uC178\uD504", "\u4F4E\u67B6", "\u0E42\u0E25\u0E27\u0E4C\u0E40\u0E0A\u0E25\u0E1F\u0E4C"],
  "Repisa alta": ["High shelf", "Prateleira alta", "Plateau aigu", "Apal altua", "\u041F\u043E\u043B\u043A\u0430 \u0412\u0427", "\u30CF\u30A4\u30B7\u30A7\u30EB\u30D5", "\uD558\uC774 \uC178\uD504", "\u9AD8\u67B6", "\u0E44\u0E2E\u0E40\u0E0A\u0E25\u0E1F\u0E4C"],
  "Corte bajo": ["Low cut", "Corte baixo", "Coupe-bas", "Behe-ebakia", "\u0421\u0440\u0435\u0437 \u041D\u0427", "\u30ED\u30FC\u30AB\u30C3\u30C8", "\uB85C\uC6B0 \uCEF7", "\u4F4E\u5207", "\u0E42\u0E25\u0E27\u0E4C\u0E04\u0E31\u0E15"],
  "Corte alto": ["High cut", "Corte alto", "Coupe-haut", "Goi-ebakia", "\u0421\u0440\u0435\u0437 \u0412\u0427", "\u30CF\u30A4\u30AB\u30C3\u30C8", "\uD558\uC774 \uCEF7", "\u9AD8\u5207", "\u0E44\u0E2E\u0E04\u0E31\u0E15"],
  Seno: ["Sine", "Senoide", "Sinus", "Sinua", "\u0421\u0438\u043D\u0443\u0441", "\u30B5\u30A4\u30F3", "\uC0AC\uC778", "\u6B63\u5F26", "\u0E44\u0E0B\u0E19\u0E4C"],
  Tri\u00E1ngulo: ["Triangle", "Tri\xE2ngulo", "Triangle", "Triangelua", "\u0422\u0440\u0435\u0443\u0433\u043E\u043B\u044C\u043D\u0438\u043A", "\u4E09\u89D2", "\uC0BC\uAC01", "\u4E09\u89D2", "\u0E2A\u0E32\u0E21\u0E40\u0E2B\u0E25\u0E35\u0E48\u0E22\u0E21"],
  Cuadrada: ["Square", "Quadrada", "Carr\xE9", "Karratua", "\u041F\u0440\u044F\u043C\u043E\u0443\u0433\u043E\u043B\u044C\u043D\u0430\u044F", "\u77E9\u5F62", "\uC0AC\uAC01", "\u65B9\u6CE2", "\u0E2A\u0E35\u0E48\u0E40\u0E2B\u0E25\u0E35\u0E48\u0E22\u0E21"],
  // --- el sampler
  Sampler: ["Sampler", "Sampler", "\xC9chantillonneur", "Sampler-a", "\u0421\u044D\u043C\u043F\u043B\u0435\u0440", "\u30B5\u30F3\u30D7\u30E9\u30FC", "\uC0D8\uD50C\uB7EC", "\u91C7\u6837\u5668", "\u0E41\u0E0B\u0E21\u0E40\u0E1E\u0E25\u0E2D\u0E23\u0E4C"],
  Volumen: ["Volume", "Volume", "Volume", "Bolumena", "\u0413\u0440\u043E\u043C\u043A\u043E\u0441\u0442\u044C", "\u97F3\u91CF", "\uBCFC\uB968", "\u97F3\u91CF", "\u0E23\u0E30\u0E14\u0E31\u0E1A\u0E40\u0E2A\u0E35\u0E22\u0E07"],
  Paneo: ["Pan", "Pan", "Panoramique", "Panoramikoa", "\u041F\u0430\u043D\u043E\u0440\u0430\u043C\u0430", "\u30D1\u30F3", "\uD32C", "\u58F0\u50CF", "\u0E41\u0E1E\u0E19"],
  Afinaci\u00F3n: ["Tuning", "Afina\xE7\xE3o", "Accord", "Afinazioa", "\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430", "\u30C1\u30E5\u30FC\u30CB\u30F3\u30B0", "\uD29C\uB2DD", "\u8C03\u97F3", "\u0E01\u0E32\u0E23\u0E08\u0E39\u0E19"],
  Decaimiento: ["Decay", "Decaimento", "D\xE9clin", "Gainbehera", "\u0421\u043F\u0430\u0434", "\u30C7\u30A3\u30B1\u30A4", "\uB514\uCF00\uC774", "\u8870\u51CF", "\u0E14\u0E35\u0E40\u0E04\u0E22\u0E4C"],
  Sostenido: ["Sustain", "Sustenta\xE7\xE3o", "Maintien", "Iraupena", "\u041F\u043E\u0434\u0434\u0435\u0440\u0436\u043A\u0430", "\u30B5\u30B9\u30C6\u30A4\u30F3", "\uC11C\uC2A4\uD14C\uC778", "\u5EF6\u97F3", "\u0E0B\u0E31\u0E2A\u0E40\u0E17\u0E19"],
  Soltado: ["Release", "Libera\xE7\xE3o", "Rel\xE2chement", "Askatzea", "\u0417\u0430\u0442\u0443\u0445\u0430\u043D\u0438\u0435", "\u30EA\u30EA\u30FC\u30B9", "\uB9B4\uB9AC\uC2A4", "\u91CA\u653E", "\u0E23\u0E35\u0E25\u0E35\u0E2A"],
  Sensibilidad: ["Velocity", "Sensibilidade", "Sensibilit\xE9", "Sentikortasuna", "\u0427\u0443\u0432\u0441\u0442\u0432\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C", "\u30D9\u30ED\u30B7\u30C6\u30A3\u611F\u5EA6", "\uBCA8\uB85C\uC2DC\uD2F0 \uAC10\uB3C4", "\u529B\u5EA6\u7075\u654F\u5EA6", "\u0E04\u0E27\u0E32\u0E21\u0E44\u0E27\u0E15\u0E48\u0E2D\u0E41\u0E23\u0E07\u0E01\u0E14"],
  Desde: ["From", "De", "De", "Hemendik", "\u041E\u0442", "\u4E0B\u9650", "\uC2DC\uC791", "\u4ECE", "\u0E08\u0E32\u0E01"],
  Hasta: ["To", "At\xE9", "\xC0", "Hona", "\u0414\u043E", "\u4E0A\u9650", "\uB05D", "\u5230", "\u0E16\u0E36\u0E07"],
  Ra\u00EDz: ["Root", "Raiz", "Fondamentale", "Erroa", "\u041A\u043E\u0440\u0435\u043D\u044C", "\u30EB\u30FC\u30C8", "\uB8E8\uD2B8", "\u6839\u97F3", "\u0E42\u0E19\u0E49\u0E15\u0E23\u0E32\u0E01"],
  "Golpe (bater\xEDa)": ["One-shot (drums)", "Disparo (bateria)", "Coup (batterie)", "Kolpea (bateria)", "\u0423\u0434\u0430\u0440 (\u0443\u0434\u0430\u0440\u043D\u044B\u0435)", "\u30EF\u30F3\u30B7\u30E7\u30C3\u30C8\uFF08\u30C9\u30E9\u30E0\uFF09", "\uC6D0\uC0F7 (\uB4DC\uB7FC)", "\u5355\u6B21\u89E6\u53D1\uFF08\u9F13\uFF09", "\u0E27\u0E31\u0E19\u0E0A\u0E47\u0E2D\u0E15 (\u0E01\u0E25\u0E2D\u0E07)"],
  Piano: ["Piano", "Piano", "Piano", "Pianoa", "\u0424\u043E\u0440\u0442\u0435\u043F\u0438\u0430\u043D\u043E", "\u30D4\u30A2\u30CE", "\uD53C\uC544\uB178", "\u94A2\u7434", "\u0E40\u0E1B\u0E35\u0E22\u0E42\u0E19"],
  Bater\u00EDa: ["Drums", "Bateria", "Batterie", "Bateria", "\u0423\u0434\u0430\u0440\u043D\u044B\u0435", "\u30C9\u30E9\u30E0", "\uB4DC\uB7FC", "\u9F13", "\u0E01\u0E25\u0E2D\u0E07"],
  "Nueva zona de piano": ["New piano zone", "Nova zona de piano", "Nouvelle zone de piano", "Piano-eremu berria", "\u041D\u043E\u0432\u0430\u044F \u0437\u043E\u043D\u0430 \u0444\u043E\u0440\u0442\u0435\u043F\u0438\u0430\u043D\u043E", "\u65B0\u3057\u3044\u30D4\u30A2\u30CE\u30BE\u30FC\u30F3", "\uC0C8 \uD53C\uC544\uB178 \uC874", "\u65B0\u5EFA\u94A2\u7434\u533A\u57DF", "\u0E42\u0E0B\u0E19\u0E40\u0E1B\u0E35\u0E22\u0E42\u0E19\u0E43\u0E2B\u0E21\u0E48"],
  "Nueva zona de bater\xEDa": ["New drum zone", "Nova zona de bateria", "Nouvelle zone de batterie", "Bateria-eremu berria", "\u041D\u043E\u0432\u0430\u044F \u0437\u043E\u043D\u0430 \u0443\u0434\u0430\u0440\u043D\u044B\u0445", "\u65B0\u3057\u3044\u30C9\u30E9\u30E0\u30BE\u30FC\u30F3", "\uC0C8 \uB4DC\uB7FC \uC874", "\u65B0\u5EFA\u9F13\u533A\u57DF", "\u0E42\u0E0B\u0E19\u0E01\u0E25\u0E2D\u0E07\u0E43\u0E2B\u0E21\u0E48"],
  "Borrar zona": ["Delete zone", "Apagar zona", "Supprimer la zone", "Ezabatu eremua", "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0437\u043E\u043D\u0443", "\u30BE\u30FC\u30F3\u3092\u524A\u9664", "\uC874 \uC0AD\uC81C", "\u5220\u9664\u533A\u57DF", "\u0E25\u0E1A\u0E42\u0E0B\u0E19"],
  Zona: ["Zone", "Zona", "Zone", "Eremua", "\u0417\u043E\u043D\u0430", "\u30BE\u30FC\u30F3", "\uC874", "\u533A\u57DF", "\u0E42\u0E0B\u0E19"],
  Zonas: ["Zones", "Zonas", "Zones", "Eremuak", "\u0417\u043E\u043D\u044B", "\u30BE\u30FC\u30F3", "\uC874", "\u533A\u57DF", "\u0E42\u0E0B\u0E19"],
  Capa: ["Layer", "Camada", "Couche", "Geruza", "\u0421\u043B\u043E\u0439", "\u30EC\u30A4\u30E4\u30FC", "\uB808\uC774\uC5B4", "\u5C42", "\u0E40\u0E25\u0E40\u0E22\u0E2D\u0E23\u0E4C"],
  "Abrir archivo": ["Open file", "Abrir arquivo", "Ouvrir un fichier", "Ireki fitxategia", "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0444\u0430\u0439\u043B", "\u30D5\u30A1\u30A4\u30EB\u3092\u958B\u304F", "\uD30C\uC77C \uC5F4\uAE30", "\u6253\u5F00\u6587\u4EF6", "\u0E40\u0E1B\u0E34\u0E14\u0E44\u0E1F\u0E25\u0E4C"],
  "Quitar capa": ["Remove layer", "Tirar camada", "Retirer la couche", "Kendu geruza", "\u0423\u0431\u0440\u0430\u0442\u044C \u0441\u043B\u043E\u0439", "\u30EC\u30A4\u30E4\u30FC\u3092\u524A\u9664", "\uB808\uC774\uC5B4 \uC81C\uAC70", "\u79FB\u9664\u5C42", "\u0E19\u0E33\u0E40\u0E25\u0E40\u0E22\u0E2D\u0E23\u0E4C\u0E2D\u0E2D\u0E01"],
  "Direcci\xF3n web del audio": ["Web address of the audio", "Endere\xE7o web do \xE1udio", "Adresse web de l\u2019audio", "Audioaren web helbidea", "\u0412\u0435\u0431-\u0430\u0434\u0440\u0435\u0441 \u0430\u0443\u0434\u0438\u043E", "\u97F3\u58F0\u306E\u30A6\u30A7\u30D6\u30A2\u30C9\u30EC\u30B9", "\uC624\uB514\uC624 \uC6F9 \uC8FC\uC18C", "\u97F3\u9891\u7684\u7F51\u5740", "\u0E17\u0E35\u0E48\u0E2D\u0E22\u0E39\u0E48\u0E40\u0E27\u0E47\u0E1A\u0E02\u0E2D\u0E07\u0E40\u0E2A\u0E35\u0E22\u0E07"],
  Cargar: ["Load", "Carregar", "Charger", "Kargatu", "\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C", "\u8AAD\u307F\u8FBC\u3080", "\uBD88\uB7EC\uC624\uAE30", "\u52A0\u8F7D", "\u0E42\u0E2B\u0E25\u0E14"],
  Loop: ["Loop", "Loop", "Boucle", "Begizta", "\u041F\u0435\u0442\u043B\u044F", "\u30EB\u30FC\u30D7", "\uB8E8\uD504", "\u5FAA\u73AF", "\u0E25\u0E39\u0E1B"],
  Entrada: ["Start", "Entrada", "Entr\xE9e", "Sarrera", "\u0412\u0445\u043E\u0434", "\u30A2\u30BF\u30C3\u30AF\u90E8", "\uC2DC\uC791\uBD80", "\u8D77\u59CB\u6BB5", "\u0E0A\u0E48\u0E27\u0E07\u0E15\u0E49\u0E19"],
  Release: ["Release", "Release", "Rel\xE2chement", "Askatzea", "\u0417\u0430\u0442\u0443\u0445\u0430\u043D\u0438\u0435", "\u30EA\u30EA\u30FC\u30B9\u90E8", "\uB9B4\uB9AC\uC2A4\uBD80", "\u91CA\u653E\u6BB5", "\u0E0A\u0E48\u0E27\u0E07\u0E1B\u0E25\u0E48\u0E2D\u0E22"],
  "Con la altura de la nota:": ["Follows the note pitch:", "Com a altura da nota:", "Suit la hauteur de la note :", "Notaren altuerarekin:", "\u0421 \u0432\u044B\u0441\u043E\u0442\u043E\u0439 \u043D\u043E\u0442\u044B:", "\u30CE\u30FC\u30C8\u306E\u97F3\u7A0B\u306B\u8FFD\u5F93:", "\uB178\uD2B8 \uC74C\uB192\uC774 \uB530\uB984:", "\u8DDF\u968F\u97F3\u9AD8\uFF1A", "\u0E15\u0E32\u0E21\u0E23\u0E30\u0E14\u0E31\u0E1A\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E02\u0E2D\u0E07\u0E42\u0E19\u0E49\u0E15:"],
  "Clic en el teclado: elegir la zona \xB7 arrastrar las marcas: d\xF3nde parte, el loop y el fin": [
    "Click the keyboard: choose the zone \xB7 drag the markers: start, loop and end",
    "Clique no teclado: escolher a zona \xB7 arrastar as marcas: in\xEDcio, loop e fim",
    "Clic sur le clavier : choisir la zone \xB7 glisser les rep\xE8res : d\xE9but, boucle et fin",
    "Klik teklatuan: aukeratu eremua \xB7 arrastatu markak: hasiera, begizta eta amaiera",
    "\u0429\u0435\u043B\u0447\u043E\u043A \u043F\u043E \u043A\u043B\u0430\u0432\u0438\u0430\u0442\u0443\u0440\u0435: \u0432\u044B\u0431\u0440\u0430\u0442\u044C \u0437\u043E\u043D\u0443 \xB7 \u043F\u0435\u0440\u0435\u0442\u0430\u0441\u043A\u0438\u0432\u0430\u0442\u044C \u043C\u0435\u0442\u043A\u0438: \u043D\u0430\u0447\u0430\u043B\u043E, \u043F\u0435\u0442\u043B\u044F \u0438 \u043A\u043E\u043D\u0435\u0446",
    "\u9375\u76E4\u3092\u30AF\u30EA\u30C3\u30AF: \u30BE\u30FC\u30F3\u3092\u9078\u629E \xB7 \u30DE\u30FC\u30AB\u30FC\u3092\u30C9\u30E9\u30C3\u30B0: \u958B\u59CB\u30FB\u30EB\u30FC\u30D7\u30FB\u7D42\u4E86",
    "\uAC74\uBC18 \uD074\uB9AD: \uC874 \uC120\uD0DD \xB7 \uB9C8\uCEE4 \uB4DC\uB798\uADF8: \uC2DC\uC791, \uB8E8\uD504, \uB05D",
    "\u5355\u51FB\u952E\u76D8\uFF1A\u9009\u62E9\u533A\u57DF \xB7 \u62D6\u52A8\u6807\u8BB0\uFF1A\u8D77\u70B9\u3001\u5FAA\u73AF\u548C\u7EC8\u70B9",
    "\u0E04\u0E25\u0E34\u0E01\u0E04\u0E35\u0E22\u0E4C\u0E1A\u0E2D\u0E23\u0E4C\u0E14: \u0E40\u0E25\u0E37\u0E2D\u0E01\u0E42\u0E0B\u0E19 \xB7 \u0E25\u0E32\u0E01\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E2B\u0E21\u0E32\u0E22: \u0E08\u0E38\u0E14\u0E40\u0E23\u0E34\u0E48\u0E21 \u0E25\u0E39\u0E1B \u0E41\u0E25\u0E30\u0E08\u0E38\u0E14\u0E08\u0E1A"
  ],
  "Sin zonas: crear una de piano o de bater\xEDa": ["No zones: create a piano or drum zone", "Sem zonas: criar uma de piano ou de bateria", "Aucune zone : en cr\xE9er une de piano ou de batterie", "Eremurik ez: sortu piano- edo bateria-eremu bat", "\u041D\u0435\u0442 \u0437\u043E\u043D: \u0441\u043E\u0437\u0434\u0430\u0439\u0442\u0435 \u0437\u043E\u043D\u0443 \u0444\u043E\u0440\u0442\u0435\u043F\u0438\u0430\u043D\u043E \u0438\u043B\u0438 \u0443\u0434\u0430\u0440\u043D\u044B\u0445", "\u30BE\u30FC\u30F3\u306A\u3057: \u30D4\u30A2\u30CE\u304B\u30C9\u30E9\u30E0\u306E\u30BE\u30FC\u30F3\u3092\u4F5C\u6210", "\uC874 \uC5C6\uC74C: \uD53C\uC544\uB178 \uB610\uB294 \uB4DC\uB7FC \uC874\uC744 \uB9CC\uB4DC\uC138\uC694", "\u6CA1\u6709\u533A\u57DF\uFF1A\u521B\u5EFA\u4E00\u4E2A\u94A2\u7434\u6216\u9F13\u533A\u57DF", "\u0E44\u0E21\u0E48\u0E21\u0E35\u0E42\u0E0B\u0E19: \u0E2A\u0E23\u0E49\u0E32\u0E07\u0E42\u0E0B\u0E19\u0E40\u0E1B\u0E35\u0E22\u0E42\u0E19\u0E2B\u0E23\u0E37\u0E2D\u0E01\u0E25\u0E2D\u0E07"],
  "Sin audio: abrir un archivo o pegar una direcci\xF3n": ["No audio: open a file or paste an address", "Sem \xE1udio: abrir um arquivo ou colar um endere\xE7o", "Pas d\u2019audio : ouvrir un fichier ou coller une adresse", "Audiorik ez: ireki fitxategi bat edo itsatsi helbide bat", "\u041D\u0435\u0442 \u0430\u0443\u0434\u0438\u043E: \u043E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u0444\u0430\u0439\u043B \u0438\u043B\u0438 \u0432\u0441\u0442\u0430\u0432\u044C\u0442\u0435 \u0430\u0434\u0440\u0435\u0441", "\u97F3\u58F0\u306A\u3057: \u30D5\u30A1\u30A4\u30EB\u3092\u958B\u304F\u304B\u30A2\u30C9\u30EC\u30B9\u3092\u8CBC\u308A\u4ED8\u3051", "\uC624\uB514\uC624 \uC5C6\uC74C: \uD30C\uC77C\uC744 \uC5F4\uAC70\uB098 \uC8FC\uC18C\uB97C \uBD99\uC5EC\uB123\uC73C\uC138\uC694", "\u6CA1\u6709\u97F3\u9891\uFF1A\u6253\u5F00\u6587\u4EF6\u6216\u7C98\u8D34\u5730\u5740", "\u0E44\u0E21\u0E48\u0E21\u0E35\u0E40\u0E2A\u0E35\u0E22\u0E07: \u0E40\u0E1B\u0E34\u0E14\u0E44\u0E1F\u0E25\u0E4C\u0E2B\u0E23\u0E37\u0E2D\u0E27\u0E32\u0E07\u0E17\u0E35\u0E48\u0E2D\u0E22\u0E39\u0E48"],
  "no se pudo abrir": ["could not be opened", "n\xE3o foi poss\xEDvel abrir", "impossible d\u2019ouvrir", "ezin izan da ireki", "\u043D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u0442\u043A\u0440\u044B\u0442\u044C", "\u958B\u3051\u307E\u305B\u3093\u3067\u3057\u305F", "\uC5F4 \uC218 \uC5C6\uC74C", "\u65E0\u6CD5\u6253\u5F00", "\u0E40\u0E1B\u0E34\u0E14\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49"],
  "bajando\u2026": ["downloading\u2026", "baixando\u2026", "t\xE9l\xE9chargement\u2026", "deskargatzen\u2026", "\u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0430\u2026", "\u30C0\u30A6\u30F3\u30ED\u30FC\u30C9\u4E2D\u2026", "\uB0B4\uB824\uBC1B\uB294 \uC911\u2026", "\u4E0B\u8F7D\u4E2D\u2026", "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E14\u0E32\u0E27\u0E19\u0E4C\u0E42\u0E2B\u0E25\u0E14\u2026"],
  "no queda guardado": ["not saved", "n\xE3o fica salvo", "non enregistr\xE9", "ez da gordetzen", "\u043D\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u044F\u0435\u0442\u0441\u044F", "\u4FDD\u5B58\u3055\u308C\u307E\u305B\u3093", "\uC800\uC7A5\uB418\uC9C0 \uC54A\uC74C", "\u4E0D\u4F1A\u4FDD\u5B58", "\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01"],
  // --- las ayudas
  "Doble clic: banda nueva o apagarla \xB7 arrastrar: mover \xB7 rueda: Q": [
    "Double-click: new band or turn it off \xB7 drag: move \xB7 wheel: Q",
    "Duplo clique: banda nova ou deslig\xE1-la \xB7 arrastar: mover \xB7 roda: Q",
    "Double-clic : nouvelle bande ou l\u2019\xE9teindre \xB7 glisser : d\xE9placer \xB7 molette : Q",
    "Klik bikoitza: banda berria edo itzali \xB7 arrastatu: mugitu \xB7 gurpila: Q",
    "\u0414\u0432\u043E\u0439\u043D\u043E\u0439 \u0449\u0435\u043B\u0447\u043E\u043A: \u043D\u043E\u0432\u0430\u044F \u043F\u043E\u043B\u043E\u0441\u0430 \u0438\u043B\u0438 \u0432\u044B\u043A\u043B\u044E\u0447\u0438\u0442\u044C \xB7 \u043F\u0435\u0440\u0435\u0442\u0430\u0449\u0438\u0442\u044C: \u0441\u0434\u0432\u0438\u043D\u0443\u0442\u044C \xB7 \u043A\u043E\u043B\u0435\u0441\u043E: Q",
    "\u30C0\u30D6\u30EB\u30AF\u30EA\u30C3\u30AF: \u30D0\u30F3\u30C9\u8FFD\u52A0\u307E\u305F\u306F\u30AA\u30D5 \xB7 \u30C9\u30E9\u30C3\u30B0: \u79FB\u52D5 \xB7 \u30DB\u30A4\u30FC\u30EB: Q",
    "\uB354\uBE14\uD074\uB9AD: \uC0C8 \uBC34\uB4DC \uB610\uB294 \uB044\uAE30 \xB7 \uB4DC\uB798\uADF8: \uC774\uB3D9 \xB7 \uD720: Q",
    "\u53CC\u51FB\uFF1A\u65B0\u5EFA\u9891\u6BB5\u6216\u5173\u95ED \xB7 \u62D6\u52A8\uFF1A\u79FB\u52A8 \xB7 \u6EDA\u8F6E\uFF1AQ",
    "\u0E14\u0E31\u0E1A\u0E40\u0E1A\u0E34\u0E25\u0E04\u0E25\u0E34\u0E01: \u0E40\u0E1E\u0E34\u0E48\u0E21\u0E41\u0E1A\u0E19\u0E14\u0E4C\u0E2B\u0E23\u0E37\u0E2D\u0E1B\u0E34\u0E14 \xB7 \u0E25\u0E32\u0E01: \u0E22\u0E49\u0E32\u0E22 \xB7 \u0E25\u0E49\u0E2D\u0E40\u0E21\u0E32\u0E2A\u0E4C: Q"
  ],
  // --- los gráficos
  "c\xF3mo est\xE1": ["before", "como est\xE1", "avant", "aurretik", "\u0434\u043E", "\u51E6\u7406\u524D", "\uCC98\uB9AC \uC804", "\u5904\u7406\u524D", "\u0E01\u0E48\u0E2D\u0E19"],
  "c\xF3mo queda": ["after", "como fica", "apr\xE8s", "ondoren", "\u043F\u043E\u0441\u043B\u0435", "\u51E6\u7406\u5F8C", "\uCC98\uB9AC \uD6C4", "\u5904\u7406\u540E", "\u0E2B\u0E25\u0E31\u0E07"],
  "c\xF3mo queda (izquierda)": ["after (left)", "como fica (esquerda)", "apr\xE8s (gauche)", "ondoren (ezkerra)", "\u043F\u043E\u0441\u043B\u0435 (\u043B\u0435\u0432\u044B\u0439)", "\u51E6\u7406\u5F8C\uFF08\u5DE6\uFF09", "\uCC98\uB9AC \uD6C4 (\uC67C\uCABD)", "\u5904\u7406\u540E\uFF08\u5DE6\uFF09", "\u0E2B\u0E25\u0E31\u0E07 (\u0E0B\u0E49\u0E32\u0E22)"],
  derecha: ["right", "direita", "droite", "eskuina", "\u043F\u0440\u0430\u0432\u044B\u0439", "\u53F3", "\uC624\uB978\uCABD", "\u53F3", "\u0E02\u0E27\u0E32"],
  reducci\u00F3n: ["reduction", "redu\xE7\xE3o", "r\xE9duction", "murrizketa", "\u0441\u043D\u0438\u0436\u0435\u043D\u0438\u0435", "\u30EA\u30C0\u30AF\u30B7\u30E7\u30F3", "\uB9AC\uB355\uC158", "\u8870\u51CF", "\u0E01\u0E32\u0E23\u0E25\u0E14\u0E17\u0E2D\u0E19"],
  Reducci\u00F3n: ["Reduction", "Redu\xE7\xE3o", "R\xE9duction", "Murrizketa", "\u0421\u043D\u0438\u0436\u0435\u043D\u0438\u0435", "\u30EA\u30C0\u30AF\u30B7\u30E7\u30F3", "\uB9AC\uB355\uC158", "\u8870\u51CF", "\u0E01\u0E32\u0E23\u0E25\u0E14\u0E17\u0E2D\u0E19"],
  "la onda del volumen (sin sonido todav\xEDa)": [
    "the volume wave (no sound yet)",
    "a onda do volume (ainda sem som)",
    "l\u2019onde du volume (pas encore de son)",
    "bolumenaren uhina (oraindik soinurik gabe)",
    "\u0432\u043E\u043B\u043D\u0430 \u0433\u0440\u043E\u043C\u043A\u043E\u0441\u0442\u0438 (\u0437\u0432\u0443\u043A\u0430 \u043F\u043E\u043A\u0430 \u043D\u0435\u0442)",
    "\u97F3\u91CF\u306E\u6CE2\u5F62\uFF08\u307E\u3060\u97F3\u306A\u3057\uFF09",
    "\uBCFC\uB968 \uD30C\uD615 (\uC544\uC9C1 \uC18C\uB9AC \uC5C6\uC74C)",
    "\u97F3\u91CF\u6CE2\u5F62\uFF08\u5C1A\u65E0\u58F0\u97F3\uFF09",
    "\u0E04\u0E25\u0E37\u0E48\u0E19\u0E23\u0E30\u0E14\u0E31\u0E1A\u0E40\u0E2A\u0E35\u0E22\u0E07 (\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E40\u0E2A\u0E35\u0E22\u0E07)"
  ],
  "la onda del volumen de cada oreja (sin sonido todav\xEDa)": [
    "the volume wave of each ear (no sound yet)",
    "a onda do volume de cada ouvido (ainda sem som)",
    "l\u2019onde du volume de chaque oreille (pas encore de son)",
    "belarri bakoitzeko bolumenaren uhina (oraindik soinurik gabe)",
    "\u0432\u043E\u043B\u043D\u0430 \u0433\u0440\u043E\u043C\u043A\u043E\u0441\u0442\u0438 \u0434\u043B\u044F \u043A\u0430\u0436\u0434\u043E\u0433\u043E \u0443\u0445\u0430 (\u0437\u0432\u0443\u043A\u0430 \u043F\u043E\u043A\u0430 \u043D\u0435\u0442)",
    "\u5DE6\u53F3\u305D\u308C\u305E\u308C\u306E\u97F3\u91CF\u306E\u6CE2\u5F62\uFF08\u307E\u3060\u97F3\u306A\u3057\uFF09",
    "\uAC01 \uADC0\uC758 \uBCFC\uB968 \uD30C\uD615 (\uC544\uC9C1 \uC18C\uB9AC \uC5C6\uC74C)",
    "\u6BCF\u53EA\u8033\u6735\u7684\u97F3\u91CF\u6CE2\u5F62\uFF08\u5C1A\u65E0\u58F0\u97F3\uFF09",
    "\u0E04\u0E25\u0E37\u0E48\u0E19\u0E23\u0E30\u0E14\u0E31\u0E1A\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E02\u0E2D\u0E07\u0E41\u0E15\u0E48\u0E25\u0E30\u0E2B\u0E39 (\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E40\u0E2A\u0E35\u0E22\u0E07)"
  ]
};
function idioma() {
  try {
    const w = typeof window !== "undefined" ? window : null;
    const crudo = w && w.idioma || typeof document !== "undefined" && document.documentElement.lang || typeof navigator !== "undefined" && navigator.language || "es";
    const c = String(crudo).slice(0, 2).toUpperCase();
    return c === "ES" || IDIOMAS.includes(c) ? c : "ES";
  } catch (e) {
    return "ES";
  }
}
function t(texto, cual = idioma()) {
  const fila = TEXTOS[texto];
  const i = IDIOMAS.indexOf(cual);
  return fila && i >= 0 ? fila[i] : texto;
}
function tEtiqueta(texto, cual = idioma()) {
  if (TEXTOS[texto]) return t(texto, cual);
  const m = /^Banda (\d+)(?:: (.+))?$/.exec(String(texto));
  if (!m) return texto;
  return `${t("Banda", cual)} ${m[1]}${m[2] ? `: ${t(m[2], cual)}` : ""}`;
}
function traducirInfo(info, cual = idioma()) {
  if (!info || cual === "ES") return info;
  const sal = {};
  for (const id of Object.keys(info)) {
    const x = info[id];
    if (!x || typeof x !== "object") {
      sal[id] = x;
      continue;
    }
    const copia = Object.assign(Object.create(Object.getPrototypeOf(x)), x);
    if (typeof x.label === "string") copia.label = tEtiqueta(x.label, cual);
    if (Array.isArray(x.choices)) copia.choices = x.choices.map((c) => t(String(c), cual));
    sal[id] = copia;
  }
  return sal;
}

// compresor/caratula.js
var PISO = -60;
var RED_MAX = 24;
var dBtxt = (x) => x <= -120 ? "\u2212\u221E" : numero(x, 1);
var tiempo = (x) => `${numero(x, x < 1 ? 2 : x < 20 ? 1 : 0)} ms`;
var PERILLAS = [
  { id: "umbral", nombre: t("Umbral"), min: -60, max: 0, paso: 0.5, porDefecto: -18, formato: (x) => `${numero(x, 1)} dB` },
  { id: "razon", nombre: t("Raz\xF3n"), min: 1, max: 20, paso: 0.1, log: true, porDefecto: 4, formato: (x) => `${numero(x, 1)} : 1` },
  { id: "ataque", nombre: t("Ataque"), min: 0.1, max: 250, paso: 1, log: true, porDefecto: 10, formato: tiempo },
  { id: "relajacion", nombre: t("Relajaci\xF3n"), min: 10, max: 2e3, paso: 1, log: true, porDefecto: 120, formato: tiempo },
  { id: "rodilla", nombre: t("Rodilla"), min: 0, max: 24, paso: 0.5, porDefecto: 6, formato: (x) => `${numero(x, 1)} dB` },
  { id: "ganancia", nombre: t("Ganancia"), min: -12, max: 24, paso: 0.5, porDefecto: 0, formato: (x) => `${x > 0 ? "+" : ""}${numero(x, 1)} dB` },
  { id: "mezcla", nombre: t("Mezcla"), min: 0, max: 100, paso: 1, porDefecto: 100, formato: (x) => `${numero(x, 0)} %` }
];
function reduccion(x, P) {
  const sobre = x - P.umbral;
  const W = P.rodilla;
  const pend = 1 - 1 / Math.max(1, P.razon);
  if (2 * sobre <= -W) return 0;
  if (2 * sobre < W) return pend * (sobre + W / 2) ** 2 / (2 * W);
  return pend * sobre;
}
async function crearCaratula(nodo) {
  const leidos = await nodo.getParameterValues(false);
  const P = { comp: 1, lim: 0, techo: -0.3 };
  for (const p of PERILLAS) P[p.id] = p.porDefecto;
  for (const id of Object.keys(P)) if (leidos && leidos[id]) P[id] = Number(leidos[id].value);
  const mandar = (id, value) => {
    P[id] = value;
    void nodo.setParameterValues({ [id]: { id, value, normalized: false } });
  };
  const caja = el(
    "div",
    `display:inline-flex;flex-direction:column;box-sizing:border-box;width:558px;user-select:none;background:${v("fondo")};color:${v("tinta")};border:1px solid ${v("borde")};font:12px/1.3 var(--pzw-letra,system-ui,sans-serif);`
  );
  const controles = {};
  const cabecera = el("div", `display:flex;align-items:center;gap:8px;padding:6px 10px;border-bottom:1px solid ${v("borde")};`);
  controles.comp = interruptor({ nombre: t("Compresor"), porDefecto: P.comp >= 0.5, alCambiar: (si) => mandar("comp", si ? 1 : 0) });
  const txtRed = el("span", `margin-left:auto;color:${v("tinta2")};font-variant-numeric:tabular-nums;`);
  cabecera.append(controles.comp.el, txtRed);
  const pantalla = el("div", "display:flex;gap:10px;padding:10px 10px 6px;");
  const curva = lienzo(130, 130);
  const historia = lienzo(340, 130);
  const medidores = lienzo(46, 130);
  curva.c.style.cursor = "ew-resize";
  curva.c.style.touchAction = "none";
  pantalla.append(curva.c, historia.c, medidores.c);
  const fila = el("div", "display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;padding:4px 10px 10px;");
  for (const p of PERILLAS) {
    controles[p.id] = perilla({ ...p, porDefecto: p.porDefecto, alCambiar: (x) => mandar(p.id, x) });
    controles[p.id].poner(P[p.id]);
    fila.append(controles[p.id].el);
  }
  const franja = el("div", `display:flex;align-items:center;gap:12px;padding:7px 10px;border-top:1px solid ${v("borde")};`);
  controles.lim = interruptor({ nombre: t("Limitador"), porDefecto: P.lim >= 0.5, alCambiar: (si) => mandar("lim", si ? 1 : 0) });
  controles.techo = casilla({
    nombre: t("Techo"),
    min: -12,
    max: 0,
    paso: 0.1,
    porDefecto: -0.3,
    formato: (x) => `${numero(x, 1)} dB`,
    alCambiar: (x) => mandar("techo", x)
  });
  controles.techo.poner(P.techo);
  const barraLim = lienzo(210, 10);
  const txtLim = el("span", `min-width:56px;text-align:right;color:${v("tinta2")};font-variant-numeric:tabular-nums;`);
  franja.append(controles.lim.el, el("span", `color:${v("tinta2")};`, t("Techo")), controles.techo.el, barraLim.c, txtLim);
  caja.append(cabecera, pantalla, fila, franja);
  let arrastrandoUmbral = false;
  const umbralDesde = (ev) => {
    const r = curva.c.getBoundingClientRect();
    const db = PISO + (ev.clientX - r.left) / r.width * -PISO;
    const x = Math.min(0, Math.max(PISO, Math.round(db * 2) / 2));
    if (x === P.umbral) return;
    mandar("umbral", x);
    controles.umbral.poner(x);
  };
  curva.c.addEventListener("pointerdown", (ev) => {
    if (ev.button !== 0) return;
    arrastrandoUmbral = true;
    try {
      curva.c.setPointerCapture(ev.pointerId);
    } catch (err) {
    }
    umbralDesde(ev);
    ev.preventDefault();
  });
  curva.c.addEventListener("pointermove", (ev) => arrastrandoUmbral && umbralDesde(ev));
  const soltarUmbral = () => arrastrandoUmbral = false;
  curva.c.addEventListener("pointerup", soltarUmbral);
  curva.c.addEventListener("pointercancel", soltarUmbral);
  const N = historia.ancho;
  const hE = new Float32Array(N).fill(-180);
  const hS = new Float32Array(N).fill(-180);
  const hR = new Float32Array(N);
  let hPos = 0;
  let ultima = nodo.medidor;
  let mE = -180;
  let mS = -180;
  let mR = 0;
  let mL = 0;
  let C = coloresDe(caja);
  let cuadros = 0;
  const marco = ({ g, ancho, alto }) => {
    g.fillStyle = C.pantalla;
    g.fillRect(0, 0, ancho, alto);
    g.strokeStyle = C.borde;
    g.lineWidth = 1;
    g.strokeRect(0.5, 0.5, ancho - 1, alto - 1);
  };
  const dibujarCurva = () => {
    const { g, ancho: W, alto: H } = curva;
    const X = (db) => (db - PISO) / -PISO * W;
    const Y = (db) => H - (db - PISO) / -PISO * H;
    marco(curva);
    g.strokeStyle = C.traza;
    g.setLineDash([3, 3]);
    g.beginPath();
    g.moveTo(0, H);
    g.lineTo(W, 0);
    g.stroke();
    g.setLineDash([]);
    g.strokeStyle = C.borde;
    g.beginPath();
    g.moveTo(Math.round(X(P.umbral)) + 0.5, 1);
    g.lineTo(Math.round(X(P.umbral)) + 0.5, H - 1);
    g.stroke();
    const encendido = P.comp >= 0.5;
    g.strokeStyle = encendido ? C.acento : C.traza;
    g.lineWidth = 2;
    g.beginPath();
    for (let px = 0; px <= W; px++) {
      const db = PISO + px / W * -PISO;
      const y = Y(db - reduccion(db, P));
      if (px === 0) g.moveTo(px, y);
      else g.lineTo(px, y);
    }
    g.stroke();
    g.lineWidth = 1;
    g.fillStyle = encendido ? C.acento : C.traza;
    g.fillRect(X(P.umbral) - 3, Y(P.umbral - reduccion(P.umbral, P)) - 3, 6, 6);
    if (mE > PISO) {
      const e = Math.min(0, mE);
      g.fillStyle = C.tinta;
      g.beginPath();
      g.arc(X(e), Y(e - (encendido ? reduccion(e, P) : 0)), 3, 0, Math.PI * 2);
      g.fill();
    }
  };
  const dibujarHistoria = () => {
    const { g, ancho: W, alto: H } = historia;
    const Y = (db) => H - (Math.max(PISO, Math.min(0, db)) - PISO) / -PISO * (H - 2) - 1;
    marco(historia);
    g.fillStyle = C.traza;
    g.beginPath();
    g.moveTo(1, H - 1);
    for (let i = 0; i < N; i++) g.lineTo(i, Y(hE[(hPos + i) % N]));
    g.lineTo(W - 1, H - 1);
    g.closePath();
    g.fill();
    g.strokeStyle = C.tinta;
    g.lineWidth = 1.25;
    g.beginPath();
    for (let i = 0; i < N; i++) {
      const y = Y(hS[(hPos + i) % N]);
      if (i === 0) g.moveTo(i, y);
      else g.lineTo(i, y);
    }
    g.stroke();
    g.lineWidth = 1;
    const yU = Math.round(Y(P.umbral)) + 0.5;
    g.strokeStyle = C.acento;
    g.setLineDash([4, 3]);
    g.beginPath();
    g.moveTo(1, yU);
    g.lineTo(W - 1, yU);
    g.stroke();
    g.setLineDash([]);
    g.beginPath();
    for (let i = 0; i < N; i++) {
      const y = 1.5 + Math.min(RED_MAX, -hR[(hPos + i) % N]) / RED_MAX * (H / 2);
      if (i === 0) g.moveTo(i, y);
      else g.lineTo(i, y);
    }
    g.strokeStyle = C.reduccion;
    g.lineWidth = 1.25;
    g.stroke();
    g.lineTo(W - 1, 1);
    g.lineTo(0, 1);
    g.closePath();
    g.fillStyle = C.reduccion;
    g.globalAlpha = 0.2;
    g.fill();
    g.globalAlpha = 1;
    g.lineWidth = 1;
    g.font = "11px system-ui, sans-serif";
    g.fillStyle = C.traza;
    g.fillRect(6, H - 15, 11, 9);
    g.fillStyle = C.tinta2;
    g.fillText(t("c\xF3mo est\xE1"), 21, H - 6);
    const x2 = 21 + g.measureText(t("c\xF3mo est\xE1")).width + 12;
    g.strokeStyle = C.tinta;
    g.lineWidth = 1.25;
    g.beginPath();
    g.moveTo(x2, H - 10.5);
    g.lineTo(x2 + 13, H - 10.5);
    g.stroke();
    g.lineWidth = 1;
    g.fillText(t("c\xF3mo queda"), x2 + 17, H - 6);
    g.fillStyle = C.reduccion;
    g.textAlign = "right";
    g.fillText(t("reducci\xF3n"), W - 6, H - 6);
    g.textAlign = "left";
  };
  const dibujarMedidores = () => {
    const { g, ancho: W, alto: H } = medidores;
    g.clearRect(0, 0, W, H);
    const alto = H - 14;
    const barra = (x, letra) => {
      g.fillStyle = C.pantalla;
      g.fillRect(x, 0, 10, alto);
      g.strokeStyle = C.borde;
      g.strokeRect(x + 0.5, 0.5, 9, alto - 1);
      g.fillStyle = C.tinta2;
      g.font = "11px system-ui, sans-serif";
      g.textAlign = "center";
      g.fillText(letra, x + 5, H - 2);
    };
    const sube = (x, db) => {
      const h = (Math.max(PISO, Math.min(0, db)) - PISO) / -PISO * (alto - 2);
      g.fillStyle = db > -0.1 ? C.reduccion : C.nivel;
      g.fillRect(x + 1, alto - 1 - h, 8, h);
    };
    barra(2, "E");
    barra(18, "R");
    barra(34, "S");
    sube(2, mE);
    sube(34, mS);
    g.fillStyle = C.reduccion;
    g.fillRect(19, 1, 8, Math.min(RED_MAX, -mR) / RED_MAX * (alto - 2));
    g.textAlign = "left";
  };
  const dibujarLimitador = () => {
    const { g, ancho: W, alto: H } = barraLim;
    marco(barraLim);
    g.fillStyle = C.reduccion;
    const w = Math.min(12, -mL) / 12 * (W - 2);
    g.fillRect(W - 1 - w, 1, w, H - 2);
  };
  let cuadro = 0;
  let reloj = 0;
  let visto = false;
  const soltar = () => {
    if (!cuadro && !reloj) return;
    cancelAnimationFrame(cuadro);
    clearInterval(reloj);
    cuadro = 0;
    reloj = 0;
    nodo.medir(false);
  };
  const pintar = () => {
    if (caja.isConnected) visto = true;
    else if (visto) return soltar();
    if (cuadros++ % 60 === 0) C = coloresDe(caja);
    const m = nodo.medidor;
    if (m !== ultima) {
      ultima = m;
      hE[hPos] = m.e;
      hS[hPos] = m.s;
      hR[hPos] = P.comp >= 0.5 ? m.r : 0;
      hPos = (hPos + 1) % N;
    }
    mE = Math.max(m.e, mE - 1.2);
    mS = Math.max(m.s, mS - 1.2);
    mR = Math.min(P.comp >= 0.5 ? m.r : 0, mR * 0.93);
    mL = Math.min(P.lim >= 0.5 ? m.l : 0, mL * 0.93);
    if (mR > -0.05) mR = 0;
    if (mL > -0.05) mL = 0;
    txtRed.textContent = `${t("Reducci\xF3n")} ${dBtxt(mR)} dB`;
    txtLim.textContent = `${dBtxt(mL)} dB`;
    dibujarCurva();
    dibujarHistoria();
    dibujarMedidores();
    dibujarLimitador();
    cuadro = requestAnimationFrame(pintar);
  };
  reloj = setInterval(() => {
    nodo.getParameterValues(false).then((vals) => {
      if (!vals || !reloj) return;
      for (const id of Object.keys(controles)) {
        if (!vals[id] || controles[id].agarrada() || id === "umbral" && arrastrandoUmbral) continue;
        const x = Number(vals[id].value);
        if (Math.abs(x - P[id]) < 1e-6) continue;
        P[id] = x;
        controles[id].poner(id === "comp" || id === "lim" ? x >= 0.5 : x);
      }
    });
  }, 500);
  nodo.medir(true);
  cuadro = requestAnimationFrame(pintar);
  caja._pzSoltar = soltar;
  return caja;
}

// compresor/index.js
var mandados = /* @__PURE__ */ new WeakMap();
var NodoCompresor = class extends WamNode {
  // Los nombres de los parámetros y sus opciones en el idioma de la página (el hilo de audio los
  // declara en castellano: no sabe de idiomas). Ver `comun/idiomas.js`.
  async getParameterInfo(...ids) {
    return traducirInfo(await super.getParameterInfo(...ids));
  }
  static addModules(contexto, moduleId) {
    let p = mandados.get(contexto);
    if (!p) {
      p = (async () => {
        await super.addModules(contexto, moduleId);
        await addFunctionModule_default(contexto.audioWorklet, dspCompresor, moduleId);
        await addFunctionModule_default(contexto.audioWorklet, procesadorCompresor, moduleId);
      })();
      mandados.set(contexto, p);
      p.catch(() => mandados.delete(contexto));
    }
    return p;
  }
  constructor(modulo) {
    super(modulo, {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2],
      channelCount: 2,
      channelCountMode: "explicit",
      channelInterpretation: "speakers"
    });
    this.medidor = { e: -180, s: -180, r: 0, l: 0 };
    this._pidenMedir = 0;
  }
  _onMessage(message) {
    const d = message.data;
    if (d && d.pz === "medidor") {
      this.medidor = d;
      return;
    }
    super._onMessage(message);
  }
  medir(si) {
    this._pidenMedir = Math.max(0, this._pidenMedir + (si ? 1 : -1));
    if (this._destroyed) return;
    this.port.postMessage({ pz: "medir", si: this._pidenMedir > 0 });
  }
};
var Compresor = class extends WebAudioModule_default {
  async initialize(estado) {
    Object.assign(this._descriptor, descriptor_default);
    if (!this._audioNode) this.audioNode = await this.createAudioNode(estado);
    this.initialized = true;
    return this;
  }
  async createAudioNode(estado) {
    await NodoCompresor.addModules(this.audioContext, this.moduleId);
    const nodo = new NodoCompresor(this);
    await nodo._initialize();
    if (estado) await nodo.setState(estado);
    return nodo;
  }
  async createGui() {
    return crearCaratula(this.audioNode);
  }
  destroyGui(gui) {
    if (gui && gui._pzSoltar) gui._pzSoltar();
  }
};
export {
  Compresor as default
};
