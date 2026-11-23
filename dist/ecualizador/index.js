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

// ecualizador/descriptor.json
var descriptor_default = {
  identifier: "org.wedwed.pizarrita.ecualizador",
  name: "Ecualizador param\xE9trico",
  vendor: "Pizarrita",
  description: "Ecualizador de 8 bandas (campana, repisas, cortes y muesca) que se arrastran sobre la curva, con el espectro detr\xE1s",
  version: "0.1.0",
  apiVersion: "2.0.0",
  thumbnail: "",
  keywords: ["effect", "equalizer", "eq", "filter"],
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

// comun/hilo.js
function mandarConFunciones(audioWorklet, fn, moduleId, ...funciones) {
  const texto = `(${fn.toString()})(${JSON.stringify(moduleId)}${funciones.map((f) => `, ${f.toString()}`).join("")});`;
  const url = URL.createObjectURL(new Blob([texto], { type: "text/javascript" }));
  return audioWorklet.addModule(url).finally(() => URL.revokeObjectURL(url));
}

// ecualizador/nucleo.js
function nucleoEq() {
  const TIPOS2 = ["Campana", "Repisa baja", "Repisa alta", "Corte bajo", "Corte alto", "Muesca"];
  const conGanancia2 = (tipo) => tipo <= 2;
  const PENDIENTES2 = ["12 dB/oct", "24 dB/oct", "36 dB/oct", "48 dB/oct"];
  const esCorte2 = (tipo) => tipo === 3 || tipo === 4;
  const etapas2 = (tipo, pend) => esCorte2(tipo) ? Math.min(4, Math.max(1, (pend | 0) + 1)) : 1;
  const qEtapa2 = (q, k, n) => {
    if (n <= 1) return q;
    const plano = 1 / (2 * Math.cos(Math.PI * (2 * k + 1) / (4 * n)));
    return k === n - 1 ? plano * (q / Math.SQRT1_2) : plano;
  };
  const coefs2 = (c, tipo, frec, ganDb, q, fm) => {
    const f = Math.min(0.49 * fm, Math.max(10, frec));
    const w = 2 * Math.PI * f / fm;
    const cs = Math.cos(w);
    const alfa = Math.sin(w) / (2 * Math.max(0.05, q));
    const A = 10 ** (ganDb / 40);
    let b0;
    let b1;
    let b2;
    let a0;
    let a1;
    let a2;
    if (tipo === 0) {
      b0 = 1 + alfa * A;
      b1 = -2 * cs;
      b2 = 1 - alfa * A;
      a0 = 1 + alfa / A;
      a1 = -2 * cs;
      a2 = 1 - alfa / A;
    } else if (tipo === 1 || tipo === 2) {
      const s = tipo === 1 ? 1 : -1;
      const r = 2 * Math.sqrt(A) * alfa;
      b0 = A * (A + 1 - s * (A - 1) * cs + r);
      b1 = s * 2 * A * (A - 1 - s * (A + 1) * cs);
      b2 = A * (A + 1 - s * (A - 1) * cs - r);
      a0 = A + 1 + s * (A - 1) * cs + r;
      a1 = -s * 2 * (A - 1 + s * (A + 1) * cs);
      a2 = A + 1 + s * (A - 1) * cs - r;
    } else {
      a0 = 1 + alfa;
      a1 = -2 * cs;
      a2 = 1 - alfa;
      if (tipo === 3) {
        b0 = (1 + cs) / 2;
        b1 = -(1 + cs);
        b2 = b0;
      } else if (tipo === 4) {
        b0 = (1 - cs) / 2;
        b1 = 1 - cs;
        b2 = b0;
      } else {
        b0 = 1;
        b1 = -2 * cs;
        b2 = 1;
      }
    }
    c[0] = b0 / a0;
    c[1] = b1 / a0;
    c[2] = b2 / a0;
    c[3] = a1 / a0;
    c[4] = a2 / a0;
    return c;
  };
  const magnitud2 = (c, frec, fm) => {
    const w = 2 * Math.PI * frec / fm;
    const c1 = Math.cos(w);
    const c2 = Math.cos(2 * w);
    const num = c[0] * c[0] + c[1] * c[1] + c[2] * c[2] + 2 * (c[0] * c[1] + c[1] * c[2]) * c1 + 2 * c[0] * c[2] * c2;
    const den = 1 + c[3] * c[3] + c[4] * c[4] + 2 * (c[3] + c[3] * c[4]) * c1 + 2 * c[4] * c2;
    return 10 * Math.log10(Math.max(1e-12, num / Math.max(1e-12, den)));
  };
  return { TIPOS: TIPOS2, PENDIENTES: PENDIENTES2, conGanancia: conGanancia2, esCorte: esCorte2, etapas: etapas2, qEtapa: qEtapa2, coefs: coefs2, magnitud: magnitud2 };
}
var BANDAS = 8;
var FRECUENCIAS = [30, 100, 250, 600, 1500, 3500, 8e3, 16e3];

// ecualizador/procesador.js
function dspEq(moduleId, nucleoEq2) {
  const ambito = globalThis.webAudioModules.getModuleScope(moduleId);
  const { coefs: coefs2, etapas: etapas2, qEtapa: qEtapa2 } = nucleoEq2();
  const MAX = 4;
  ambito.pzCrearEq = (fm, bandas) => {
    const c = [];
    for (let i = 0; i < bandas * MAX; i++) c.push(new Float64Array(5));
    const activa = new Uint8Array(bandas);
    const cuantas = new Uint8Array(bandas).fill(1);
    const puesto = new Float64Array(bandas * 5).fill(NaN);
    const z = new Float64Array(bandas * MAX * 4);
    const poner = (b, encendida, tipo, frec, gan, q, pend) => {
      if (!encendida) {
        activa[b] = 0;
        return;
      }
      const n = etapas2(tipo, pend);
      if (!activa[b] || n !== cuantas[b]) z.fill(0, b * MAX * 4, (b + 1) * MAX * 4);
      activa[b] = 1;
      const k = b * 5;
      if (puesto[k] === tipo && puesto[k + 1] === frec && puesto[k + 2] === gan && puesto[k + 3] === q && puesto[k + 4] === n) return;
      puesto[k] = tipo;
      puesto[k + 1] = frec;
      puesto[k + 2] = gan;
      puesto[k + 3] = q;
      puesto[k + 4] = n;
      cuantas[b] = n;
      for (let s = 0; s < n; s++) coefs2(c[b * MAX + s], tipo, frec, gan, qEtapa2(q, s, n), fm);
    };
    const procesar = (eI, eD, sI, sD, desde, hasta, gan) => {
      for (let i = desde; i < hasta; i++) {
        sI[i] = eI[i];
        sD[i] = eD[i];
      }
      for (let e = 0; e < bandas * MAX; e++) {
        const b = e / MAX | 0;
        if (!activa[b] || e - b * MAX >= cuantas[b]) continue;
        const cb = c[e];
        const b0 = cb[0];
        const b1 = cb[1];
        const b2 = cb[2];
        const a1 = cb[3];
        const a2 = cb[4];
        const k = e * 4;
        let z1 = z[k];
        let z2 = z[k + 1];
        let y1 = z[k + 2];
        let y2 = z[k + 3];
        for (let i = desde; i < hasta; i++) {
          const x = sI[i];
          const y = b0 * x + z1;
          z1 = b1 * x - a1 * y + z2;
          z2 = b2 * x - a2 * y;
          sI[i] = y;
          const u = sD[i];
          const w = b0 * u + y1;
          y1 = b1 * u - a1 * w + y2;
          y2 = b2 * u - a2 * w;
          sD[i] = w;
        }
        z[k] = z1 > -1e-20 && z1 < 1e-20 ? 0 : z1;
        z[k + 1] = z2 > -1e-20 && z2 < 1e-20 ? 0 : z2;
        z[k + 2] = y1 > -1e-20 && y1 < 1e-20 ? 0 : y1;
        z[k + 3] = y2 > -1e-20 && y2 < 1e-20 ? 0 : y2;
      }
      if (gan !== 1) {
        for (let i = desde; i < hasta; i++) {
          sI[i] *= gan;
          sD[i] *= gan;
        }
      }
    };
    return { poner, procesar };
  };
}
function procesadorEq(moduleId, nucleoEq2) {
  const ambito = globalThis.webAudioModules.getModuleScope(moduleId);
  const { WamProcessor, WamParameterInfo, pzCrearEq } = ambito;
  const { TIPOS: TIPOS2, PENDIENTES: PENDIENTES2 } = nucleoEq2();
  const BANDAS2 = 8;
  const FRECUENCIAS2 = [30, 100, 250, 600, 1500, 3500, 8e3, 16e3];
  class ProcesadorEq extends WamProcessor {
    constructor(options) {
      super(options);
      this._dsp = pzCrearEq(sampleRate, BANDAS2);
      this._cero = new Float32Array(128);
      this._ids = [];
      for (let b = 1; b <= BANDAS2; b++) this._ids.push([`b${b}on`, `b${b}tipo`, `b${b}frec`, `b${b}gan`, `b${b}q`, `b${b}pend`]);
    }
    _generateWamParameterInfo() {
      const info = {};
      const f = (id, label, defaultValue, minValue, maxValue, units) => {
        info[id] = new WamParameterInfo(id, { type: "float", label, defaultValue, minValue, maxValue, units });
      };
      for (let b = 1; b <= BANDAS2; b++) {
        info[`b${b}on`] = new WamParameterInfo(`b${b}on`, { type: "boolean", label: `Banda ${b}`, defaultValue: 0 });
        info[`b${b}tipo`] = new WamParameterInfo(`b${b}tipo`, { type: "choice", label: `Banda ${b}: tipo`, defaultValue: 0, choices: TIPOS2 });
        f(`b${b}frec`, `Banda ${b}: frecuencia`, FRECUENCIAS2[b - 1], 20, 2e4, "Hz");
        f(`b${b}gan`, `Banda ${b}: ganancia`, 0, -24, 24, "dB");
        f(`b${b}q`, `Banda ${b}: Q`, 1, 0.1, 18, "");
        info[`b${b}pend`] = new WamParameterInfo(`b${b}pend`, { type: "choice", label: `Banda ${b}: pendiente del corte`, defaultValue: 0, choices: PENDIENTES2 });
      }
      f("salida", "Salida", 0, -24, 24, "dB");
      return info;
    }
    _process(desde, hasta, inputs, outputs) {
      const sal = outputs[0];
      if (!sal || !sal.length) return;
      const ent = inputs[0];
      const eI = ent && ent[0] ? ent[0] : this._cero;
      const eD = ent && ent[1] ? ent[1] : eI;
      const I = this._parameterInterpolators;
      for (let b = 0; b < BANDAS2; b++) {
        const id = this._ids[b];
        this._dsp.poner(
          b,
          I[id[0]].values[desde] >= 0.5,
          Math.round(I[id[1]].values[desde]),
          I[id[2]].values[desde],
          I[id[3]].values[desde],
          I[id[4]].values[desde],
          Math.round(I[id[5]].values[desde])
        );
      }
      const db = I.salida.values[desde];
      this._dsp.procesar(eI, eD, sal[0], sal[1] || sal[0], desde, hasta, db === 0 ? 1 : 10 ** (db / 20));
      const copia = outputs[1] && outputs[1][0];
      if (copia) for (let i = desde; i < hasta; i++) copia[i] = 0.5 * (eI[i] + eD[i]);
    }
  }
  try {
    registerProcessor(moduleId, ProcesadorEq);
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
function coloresDe(el2) {
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
  const fijar = (t) => escribir(Math.min(1, Math.max(0, t)));
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
  const deT = (t) => {
    const x = log ? min * (max / min) ** t : min + t * (max - min);
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
  const arco = (t) => {
    const [x0, y0] = punto(135);
    const [x1, y1] = punto(135 + 270 * t);
    return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${R} ${R} 0 ${270 * t > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
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
    const t = Math.min(1, Math.max(0, aT(valor)));
    lleno.setAttribute("d", t > 1e-3 ? arco(t) : "");
    const [x, y] = punto(135 + 270 * t);
    aguja.setAttribute("x2", x.toFixed(2));
    aguja.setAttribute("y2", y.toFixed(2));
    texto.textContent = o.formato(valor);
    svg.setAttribute("aria-valuetext", texto.textContent);
  };
  arrastrable(svg, {
    leer: () => aT(valor),
    escribir: (t) => {
      const nuevo = deT(t);
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
function elegidor(o) {
  const s = el(
    "select",
    `font:inherit;color:${v("tinta")};background:${v("pantalla")};border:1px solid ${v("borde")};border-radius:0;padding:1px 2px;max-width:100%;`
  );
  s.setAttribute("aria-label", o.nombre);
  o.opciones.forEach((texto, i) => {
    const op = document.createElement("option");
    op.value = String(i);
    op.textContent = texto;
    s.append(op);
  });
  s.addEventListener("change", () => o.alCambiar(Number(s.value)));
  return {
    el: s,
    poner: (i) => {
      s.value = String(i);
    },
    agarrada: () => document.activeElement === s
  };
}

// ecualizador/caratula.js
var { TIPOS, PENDIENTES, conGanancia, esCorte, etapas, qEtapa, coefs, magnitud } = nucleoEq();
var F_MIN = 20;
var F_MAX = 2e4;
var RANGO = 24;
var PISO_ESPECTRO = -100;
var TECHO_ESPECTRO = -10;
var hz = (f) => f < 1e3 ? `${Math.round(f)} Hz` : `${numero(f / 1e3, f < 1e4 ? 2 : 1)} kHz`;
var dB = (x) => `${x > 0 ? "+" : ""}${numero(x, 1)} dB`;
var entre = (x, a, b) => Math.min(b, Math.max(a, x));
async function crearCaratula(nodo) {
  const fm = nodo.context.sampleRate;
  const leidos = await nodo.getParameterValues(false);
  const lee = (id, porDefecto) => leidos && leidos[id] ? Number(leidos[id].value) : porDefecto;
  const B = [];
  for (let i = 0; i < BANDAS; i++) {
    const n = i + 1;
    B.push({
      on: lee(`b${n}on`, 0) >= 0.5,
      tipo: Math.round(lee(`b${n}tipo`, 0)),
      frec: lee(`b${n}frec`, FRECUENCIAS[i]),
      gan: lee(`b${n}gan`, 0),
      q: lee(`b${n}q`, 1),
      pend: Math.round(lee(`b${n}pend`, 0)),
      c: [new Float64Array(5), new Float64Array(5), new Float64Array(5), new Float64Array(5)]
    });
  }
  let salida = lee("salida", 0);
  let sel = B.findIndex((b) => b.on);
  let sucio = true;
  const ponerBanda = (i, campos) => {
    const cambios = {};
    for (const campo of Object.keys(campos)) {
      B[i][campo] = campos[campo];
      const id = `b${i + 1}${campo}`;
      cambios[id] = { id, value: campo === "on" ? campos[campo] ? 1 : 0 : campos[campo], normalized: false };
    }
    sucio = true;
    void nodo.setParameterValues(cambios);
  };
  const caja = el(
    "div",
    `display:inline-flex;flex-direction:column;box-sizing:border-box;width:558px;user-select:none;background:${v("fondo")};color:${v("tinta")};border:1px solid ${v("borde")};font:12px/1.3 var(--pzw-letra,system-ui,sans-serif);`
  );
  const cabecera = el("div", `display:flex;align-items:baseline;gap:8px;padding:6px 10px;border-bottom:1px solid ${v("borde")};`);
  cabecera.append(
    el("span", "font-weight:bold;font-size:13px;", "Ecualizador"),
    el("span", `margin-left:auto;color:${v("tinta2")};font-size:11px;`, "Doble clic: banda nueva o apagarla \xB7 arrastrar: mover \xB7 rueda: Q")
  );
  const grafico = lienzo(536, 220);
  grafico.c.style.cursor = "crosshair";
  grafico.c.style.touchAction = "none";
  const marcoGrafico = el("div", "padding:10px 10px 8px;");
  marcoGrafico.append(grafico.c);
  const W = grafico.ancho;
  const H = grafico.alto;
  const X = (f) => Math.log(f / F_MIN) / Math.log(F_MAX / F_MIN) * W;
  const FX = (x) => F_MIN * (F_MAX / F_MIN) ** (x / W);
  const Y = (g) => H / 2 - g / RANGO * (H / 2 - 10);
  const GY = (y) => (H / 2 - y) / (H / 2 - 10) * RANGO;
  const punto = (b) => [X(b.frec), Y(conGanancia(b.tipo) ? b.gan : 0)];
  const franja = el("div", `display:flex;align-items:center;gap:10px;padding:7px 10px;border-top:1px solid ${v("borde")};`);
  const botones = el("div", "display:flex;gap:3px;");
  const boton = [];
  for (let i = 0; i < BANDAS; i++) {
    const b = el(
      "button",
      `width:20px;height:20px;box-sizing:border-box;padding:0;border-radius:0;cursor:pointer;font:inherit;font-size:11px;color:${v("tinta")};`,
      String(i + 1)
    );
    b.type = "button";
    b.setAttribute("aria-label", `Banda ${i + 1}`);
    b.addEventListener("click", () => {
      sel = i;
      pintarFranja();
    });
    boton.push(b);
    botones.append(b);
  }
  const encendida = interruptor({ nombre: "Encendida", porDefecto: false, alCambiar: (si) => sel >= 0 && (ponerBanda(sel, { on: si }), pintarFranja()) });
  const tipo = elegidor({ nombre: "Tipo de banda", opciones: TIPOS, alCambiar: (t) => sel >= 0 && (ponerBanda(sel, { tipo: t }), pintarFranja()) });
  const pend = elegidor({ nombre: "Pendiente del corte", opciones: PENDIENTES, alCambiar: (x) => sel >= 0 && ponerBanda(sel, { pend: x }) });
  franja.append(botones, encendida.el, tipo.el, pend.el);
  const fila = el("div", `display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;padding:4px 10px 10px;`);
  const pFrec = perilla({ nombre: "Frecuencia", min: F_MIN, max: F_MAX, paso: 1, log: true, porDefecto: 1e3, formato: hz, alCambiar: (x) => sel >= 0 && ponerBanda(sel, { frec: x }) });
  const pGan = perilla({ nombre: "Ganancia", min: -RANGO, max: RANGO, paso: 0.1, porDefecto: 0, formato: dB, alCambiar: (x) => sel >= 0 && ponerBanda(sel, { gan: x }) });
  const pQ = perilla({ nombre: "Q", min: 0.1, max: 18, paso: 0.01, log: true, porDefecto: 1, formato: (x) => numero(x, 2), alCambiar: (x) => sel >= 0 && ponerBanda(sel, { q: x }) });
  const pSalida = perilla({
    nombre: "Salida",
    min: -RANGO,
    max: RANGO,
    paso: 0.1,
    porDefecto: 0,
    formato: dB,
    alCambiar: (x) => {
      salida = x;
      sucio = true;
      void nodo.setParameterValues({ salida: { id: "salida", value: x, normalized: false } });
    }
  });
  pSalida.poner(salida);
  pSalida.el.style.borderLeft = `1px solid ${v("borde")}`;
  fila.append(pFrec.el, pGan.el, pQ.el, pSalida.el);
  const apagar = (e, si) => {
    e.style.opacity = si ? "0.35" : "";
    e.style.pointerEvents = si ? "none" : "";
  };
  function pintarFranja() {
    for (let i = 0; i < BANDAS; i++) {
      boton[i].style.background = B[i].on ? v("acento") : v("pantalla");
      boton[i].style.border = i === sel ? `2px solid ${v("tinta")}` : `1px solid ${v("borde")}`;
      boton[i].style.fontWeight = i === sel ? "bold" : "";
    }
    const b = sel >= 0 ? B[sel] : null;
    for (const e of [encendida.el, tipo.el, pFrec.el, pQ.el]) apagar(e, !b);
    apagar(pGan.el, !b || !conGanancia(b.tipo));
    pend.el.style.visibility = b && esCorte(b.tipo) ? "" : "hidden";
    if (!b) return;
    encendida.poner(b.on);
    tipo.poner(b.tipo);
    pend.poner(b.pend);
    pFrec.poner(b.frec);
    pGan.poner(b.gan);
    pQ.poner(b.q);
  }
  caja.append(cabecera, marcoGrafico, franja, fila);
  pintarFranja();
  const lugar = (ev) => {
    const r = grafico.c.getBoundingClientRect();
    return [(ev.clientX - r.left) * W / r.width, (ev.clientY - r.top) * H / r.height];
  };
  const bandaEn = (x, y) => {
    let mejor = -1;
    let dMejor = 121;
    for (let i = 0; i < BANDAS; i++) {
      if (!B[i].on) continue;
      const [px, py] = punto(B[i]);
      const d = (px - x) ** 2 + (py - y) ** 2;
      if (d < dMejor) {
        dMejor = d;
        mejor = i;
      }
    }
    return mejor;
  };
  let arrastrando = -1;
  grafico.c.addEventListener("pointerdown", (ev) => {
    if (ev.button !== 0) return;
    const [x, y] = lugar(ev);
    const i = bandaEn(x, y);
    if (i < 0) return;
    sel = i;
    arrastrando = i;
    try {
      grafico.c.setPointerCapture(ev.pointerId);
    } catch (err) {
    }
    pintarFranja();
    ev.preventDefault();
  });
  grafico.c.addEventListener("pointermove", (ev) => {
    if (arrastrando < 0) return;
    const [x, y] = lugar(ev);
    const b = B[arrastrando];
    const campos = { frec: Math.round(entre(FX(x), F_MIN, F_MAX)) };
    if (conGanancia(b.tipo)) campos.gan = Math.round(entre(GY(y), -RANGO, RANGO) * 10) / 10;
    ponerBanda(arrastrando, campos);
    pFrec.poner(b.frec);
    pGan.poner(b.gan);
  });
  const soltarBanda = () => arrastrando = -1;
  grafico.c.addEventListener("pointerup", soltarBanda);
  grafico.c.addEventListener("pointercancel", soltarBanda);
  grafico.c.addEventListener("dblclick", (ev) => {
    const [x, y] = lugar(ev);
    const i = bandaEn(x, y);
    if (i >= 0) {
      ponerBanda(i, { on: false });
      if (sel === i) sel = B.findIndex((b) => b.on);
    } else {
      const libre = B.findIndex((b) => !b.on);
      if (libre < 0) return;
      const frec = Math.round(entre(FX(x), F_MIN, F_MAX));
      const t = frec < 40 ? 3 : frec > 12e3 ? 4 : 0;
      ponerBanda(libre, { tipo: t, frec, gan: t === 0 ? Math.round(entre(GY(y), -RANGO, RANGO) * 10) / 10 : 0, q: t === 0 ? 1 : 0.71, on: true });
      sel = libre;
    }
    pintarFranja();
  });
  grafico.c.addEventListener(
    "wheel",
    (ev) => {
      if (sel < 0 || !B[sel].on) return;
      ev.preventDefault();
      const q = Math.round(entre(B[sel].q * (ev.deltaY < 0 ? 1.12 : 1 / 1.12), 0.1, 18) * 100) / 100;
      ponerBanda(sel, { q });
      pQ.poner(q);
    },
    { passive: false }
  );
  const analizar = (salidaDelNodo) => {
    try {
      const an = new AnalyserNode(nodo.context, { fftSize: 4096, smoothingTimeConstant: 0.8 });
      nodo.connect(an, salidaDelNodo);
      return { an, datos: new Float32Array(an.frequencyBinCount) };
    } catch (e) {
      return null;
    }
  };
  const queda = analizar(0);
  const esta = nodo.numberOfOutputs > 1 ? analizar(1) : null;
  const curva = new Float32Array(W + 1);
  let C = coloresDe(caja);
  let cuadros = 0;
  const calcular = () => {
    curva.fill(salida);
    for (const b of B) {
      if (!b.on) continue;
      const n = etapas(b.tipo, b.pend);
      for (let s = 0; s < n; s++) {
        coefs(b.c[s], b.tipo, b.frec, b.gan, qEtapa(b.q, s, n), fm);
        for (let px = 0; px <= W; px++) curva[px] += magnitud(b.c[s], FX(px), fm);
      }
    }
    sucio = false;
  };
  const dibujar = () => {
    const g = grafico.g;
    g.fillStyle = C.pantalla;
    g.fillRect(0, 0, W, H);
    g.lineWidth = 1;
    g.font = "11px system-ui, sans-serif";
    g.textBaseline = "alphabetic";
    for (const f of [50, 100, 200, 500, 1e3, 2e3, 5e3, 1e4]) {
      const x = Math.round(X(f)) + 0.5;
      g.strokeStyle = C.traza;
      g.globalAlpha = f === 100 || f === 1e3 || f === 1e4 ? 0.9 : 0.45;
      g.beginPath();
      g.moveTo(x, 1);
      g.lineTo(x, H - 1);
      g.stroke();
    }
    g.globalAlpha = 1;
    g.fillStyle = C.tinta2;
    g.textAlign = "left";
    for (const [f, t] of [[100, "100"], [1e3, "1 k"], [1e4, "10 k"]]) g.fillText(t, X(f) + 3, H - 4);
    for (const db of [-12, 12]) {
      const y = Math.round(Y(db)) + 0.5;
      g.strokeStyle = C.traza;
      g.globalAlpha = 0.45;
      g.beginPath();
      g.moveTo(1, y);
      g.lineTo(W - 1, y);
      g.stroke();
      g.globalAlpha = 1;
      g.fillText(db > 0 ? "+12" : "\u221212", 4, y - 3);
    }
    const trazo = (e) => {
      e.an.getFloatFrequencyData(e.datos);
      const d = e.datos;
      const binHz = fm / e.an.fftSize;
      let hay = false;
      g.beginPath();
      for (let px = 0; px <= W; px++) {
        const pos = FX(px) / binHz;
        const i0 = Math.min(d.length - 2, Math.floor(pos));
        const i1 = Math.min(d.length - 1, Math.max(i0 + 1, Math.floor(FX(px + 1) / binHz)));
        let x;
        if (i1 === i0 + 1) x = d[i0] + (d[i1] - d[i0]) * (pos - i0);
        else {
          x = d[i0];
          for (let i = i0 + 1; i <= i1; i++) if (d[i] > x) x = d[i];
        }
        if (!(x > PISO_ESPECTRO)) x = PISO_ESPECTRO;
        else hay = true;
        const y = H - (entre(x, PISO_ESPECTRO, TECHO_ESPECTRO) - PISO_ESPECTRO) / (TECHO_ESPECTRO - PISO_ESPECTRO) * (H - 2);
        if (px === 0) g.moveTo(px, y);
        else g.lineTo(px, y);
      }
      return hay;
    };
    let hayEsta = false;
    let hayQueda = false;
    if (esta && trazo(esta)) {
      hayEsta = true;
      g.lineTo(W, H);
      g.lineTo(0, H);
      g.closePath();
      g.fillStyle = C.traza;
      g.globalAlpha = 0.6;
      g.fill();
      g.globalAlpha = 1;
    }
    if (queda && trazo(queda)) {
      hayQueda = true;
      g.strokeStyle = C.tinta2;
      g.lineWidth = 1.25;
      g.stroke();
      g.lineWidth = 1;
    }
    if (hayEsta || hayQueda) {
      g.textAlign = "right";
      g.fillStyle = C.tinta2;
      g.fillText("c\xF3mo queda", W - 6, 14);
      const a1 = W - 6 - g.measureText("c\xF3mo queda").width;
      g.strokeStyle = C.tinta2;
      g.lineWidth = 1.25;
      g.beginPath();
      g.moveTo(a1 - 18, 10.5);
      g.lineTo(a1 - 5, 10.5);
      g.stroke();
      g.lineWidth = 1;
      if (esta) {
        g.fillText("c\xF3mo est\xE1", a1 - 28, 14);
        const a2 = a1 - 28 - g.measureText("c\xF3mo est\xE1").width;
        g.fillStyle = C.traza;
        g.fillRect(a2 - 16, 6, 11, 9);
      }
      g.textAlign = "left";
    }
    g.strokeStyle = C.borde;
    g.beginPath();
    g.moveTo(1, Math.round(Y(0)) + 0.5);
    g.lineTo(W - 1, Math.round(Y(0)) + 0.5);
    g.stroke();
    g.beginPath();
    for (let px = 0; px <= W; px++) {
      const y = entre(Y(curva[px]), 0, H);
      if (px === 0) g.moveTo(px, y);
      else g.lineTo(px, y);
    }
    g.strokeStyle = C.acento;
    g.lineWidth = 2;
    g.stroke();
    g.lineTo(W, Y(0));
    g.lineTo(0, Y(0));
    g.closePath();
    g.fillStyle = C.acento;
    g.globalAlpha = 0.15;
    g.fill();
    g.globalAlpha = 1;
    g.lineWidth = 1;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = "bold 11px system-ui, sans-serif";
    for (let i = 0; i < BANDAS; i++) {
      if (!B[i].on) continue;
      const [x, y] = punto(B[i]);
      g.beginPath();
      g.arc(x, y, 8, 0, Math.PI * 2);
      g.fillStyle = i === sel ? C.tinta : C.acento;
      g.fill();
      g.fillStyle = i === sel ? C.pantalla : C.tinta;
      g.fillText(String(i + 1), x, y + 0.5);
    }
    g.strokeStyle = C.borde;
    g.strokeRect(0.5, 0.5, W - 1, H - 1);
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
    for (const e of [queda, esta]) {
      if (!e) continue;
      try {
        nodo.disconnect(e.an);
      } catch (err) {
      }
    }
  };
  const pintar = () => {
    if (caja.isConnected) visto = true;
    else if (visto) return soltar();
    if (cuadros++ % 60 === 0) C = coloresDe(caja);
    if (sucio) calcular();
    dibujar();
    cuadro = requestAnimationFrame(pintar);
  };
  const CAMPOS = ["on", "tipo", "frec", "gan", "q", "pend"];
  reloj = setInterval(() => {
    [queda, esta].forEach((e, salidaDelNodo) => {
      if (!e) return;
      try {
        nodo.connect(e.an, salidaDelNodo);
      } catch (err) {
      }
    });
    nodo.getParameterValues(false).then((vals) => {
      if (!vals || !reloj) return;
      let cambio = false;
      for (let i = 0; i < BANDAS; i++) {
        if (i === arrastrando) continue;
        if (i === sel && (pFrec.agarrada() || pGan.agarrada() || pQ.agarrada() || tipo.agarrada() || pend.agarrada())) continue;
        for (const campo of CAMPOS) {
          const dato = vals[`b${i + 1}${campo}`];
          if (!dato) continue;
          const entero = campo === "tipo" || campo === "pend";
          const x = campo === "on" ? Number(dato.value) >= 0.5 : entero ? Math.round(Number(dato.value)) : Number(dato.value);
          if (campo === "on" || entero ? x === B[i][campo] : Math.abs(x - B[i][campo]) < 1e-4) continue;
          B[i][campo] = x;
          cambio = true;
        }
      }
      if (vals.salida && !pSalida.agarrada() && Math.abs(Number(vals.salida.value) - salida) > 1e-4) {
        salida = Number(vals.salida.value);
        pSalida.poner(salida);
        cambio = true;
      }
      if (!cambio) return;
      if (sel < 0) sel = B.findIndex((b) => b.on);
      sucio = true;
      pintarFranja();
    });
  }, 500);
  cuadro = requestAnimationFrame(pintar);
  caja._pzSoltar = soltar;
  return caja;
}

// ecualizador/index.js
var mandados = /* @__PURE__ */ new WeakMap();
var NodoEq = class extends WamNode {
  static addModules(contexto, moduleId) {
    let p = mandados.get(contexto);
    if (!p) {
      p = (async () => {
        await super.addModules(contexto, moduleId);
        await mandarConFunciones(contexto.audioWorklet, dspEq, moduleId, nucleoEq);
        await mandarConFunciones(contexto.audioWorklet, procesadorEq, moduleId, nucleoEq);
      })();
      mandados.set(contexto, p);
      p.catch(() => mandados.delete(contexto));
    }
    return p;
  }
  constructor(modulo) {
    super(modulo, {
      numberOfInputs: 1,
      // la salida 0 es el sonido ecualizado; la 1, la entrada sin tocar, para el espectro
      numberOfOutputs: 2,
      outputChannelCount: [2, 1],
      channelCount: 2,
      channelCountMode: "explicit",
      channelInterpretation: "speakers"
    });
  }
};
var Ecualizador = class extends WebAudioModule_default {
  async initialize(estado) {
    Object.assign(this._descriptor, descriptor_default);
    if (!this._audioNode) this.audioNode = await this.createAudioNode(estado);
    this.initialized = true;
    return this;
  }
  async createAudioNode(estado) {
    await NodoEq.addModules(this.audioContext, this.moduleId);
    const nodo = new NodoEq(this);
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
  Ecualizador as default
};
