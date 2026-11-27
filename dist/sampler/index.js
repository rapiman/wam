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
        const N2 = this._N;
        const table = new Float32Array(N2 + 1);
        if (linear)
          for (let n = 0; n <= N2; ++n)
            table[n] = n / N2;
        else
          for (let n = 0; n <= N2; ++n)
            table[n] = (n / N2) ** e;
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

// sampler/descriptor.json
var descriptor_default = {
  identifier: "org.wedwed.pizarrita.sampler",
  name: "Sampler",
  vendor: "Pizarrita",
  description: "Sampler por zonas: piano o bater\xEDa, hasta tres capas por sonido, cada una con entrada, loop y release",
  version: "0.1.0",
  apiVersion: "2.0.0",
  thumbnail: "",
  keywords: ["instrument", "sampler"],
  isInstrument: true,
  website: "",
  hasAudioInput: false,
  hasAudioOutput: true,
  hasAutomationInput: true,
  hasAutomationOutput: false,
  hasMidiInput: true,
  hasMidiOutput: false,
  hasMpeInput: false,
  hasMpeOutput: false,
  hasOscInput: false,
  hasOscOutput: false,
  hasSysexInput: false,
  hasSysexOutput: false
};

// comun/hilo.js
function mandarConFunciones(audioWorklet, fn, moduleId, ...cosas) {
  const args = cosas.map((c) => `, ${typeof c === "function" ? c.toString() : JSON.stringify(c === void 0 ? null : c)}`).join("");
  const texto = `(${fn.toString()})(${JSON.stringify(moduleId)}${args});`;
  const url = URL.createObjectURL(new Blob([texto], { type: "text/javascript" }));
  return audioWorklet.addModule(url).finally(() => URL.revokeObjectURL(url));
}

// sampler/nucleo.js
function nucleoSampler() {
  const TIPOS_FILTRO = ["Apagado", "Pasa bajos", "Pasa altos", "Pasa banda"];
  const FORMAS = ["Seno", "Tri\xE1ngulo", "Cuadrada", "Sierra", "Azar"];
  const DESTINOS = ["Altura", "Volumen", "Filtro", "Distorsi\xF3n", "Paneo"];
  const POLARIDAD = ["+", "x", "\u2212"];
  const MODELOS = ["Bisel", "Labios", "Ca\xF1a"];
  const FUENTES_AIRE = ["Intensidad", "Rueda", "Aliento", "Expresi\xF3n", "Aftertouch"];
  const CUERPOS = ["Madera", "Campana", "Caja"];
  const TRAMOS = [
    ["A", "Ataque"],
    ["D", "Decaimiento"],
    ["S", "Pendiente"],
    ["R", "Soltado"]
  ];
  const vaiven = (k) => [
    { id: `l${k}f`, nombre: `Forma del vaiv\xE9n ${k}`, corto: "Forma", grupo: `v${k}`, tipo: "choice", opciones: FORMAS, defecto: 0, min: 0, max: FORMAS.length - 1 },
    { id: `l${k}v`, nombre: `Velocidad del vaiv\xE9n ${k}`, corto: "Velocidad", grupo: `v${k}`, min: 0.05, max: 30, defecto: 2, unidad: "Hz", paso: 0.01, dec: 2, log: true },
    { id: `l${k}p`, nombre: `Profundidad del vaiv\xE9n ${k}`, corto: "Profundidad", grupo: `v${k}`, min: 0, max: 100, defecto: 0, unidad: "%", paso: 1 },
    { id: `l${k}d`, nombre: `Destino del vaiv\xE9n ${k}`, corto: "Destino", grupo: `v${k}`, tipo: "choice", opciones: DESTINOS, defecto: k === 1 ? 0 : 2, min: 0, max: DESTINOS.length - 1 }
  ];
  const tiempo = (defecto) => ({ min: 0.5, max: 1e4, defecto, unidad: "ms", paso: 0.1, dec: 1, log: true });
  const nivel = (defecto, bipolar) => ({ min: bipolar ? -100 : 0, max: 100, defecto, unidad: "%", paso: 1 });
  const polaridades = (k, pre, sub, que) => TRAMOS.map(([L, nom]) => ({
    id: `c${k}${pre}${L}`,
    nombre: `${que}: ${nom}`,
    corto: L,
    sub,
    tipo: "choice",
    opciones: POLARIDAD,
    defecto: 0,
    min: 0,
    max: 2,
    angosto: true
  }));
  const capa = (k) => {
    const P = (lista, grupo) => lista.map((p) => ({ ...p, id: p.id.startsWith(`c${k}`) ? p.id : `c${k}${p.id}`, nombre: `Capa ${k}: ${p.nombre}`, grupo: `c${k}${grupo}` }));
    return [
      ...P(
        [
          { id: "niv", nombre: "Nivel", sub: "capa", min: -40, max: 12, defecto: 0, unidad: "dB", paso: 0.1, dec: 1 },
          { id: "afi", nombre: "Afinaci\xF3n", sub: "capa", min: -24, max: 24, defecto: 0, unidad: "st", paso: 0.01, dec: 2 },
          { id: "ret", nombre: "Retardo de entrada", corto: "Retardo", sub: "capa", min: 0, max: 2e3, defecto: 0, unidad: "ms", paso: 1 },
          { id: "vat", nombre: "Ataque del volumen", corto: "Ataque", sub: "env", ...tiempo(2) },
          { id: "val", nombre: "Nivel de ataque del volumen", corto: "Cima", sub: "env", ...nivel(100) },
          { id: "vdt", nombre: "Decaimiento del volumen", corto: "Decaimiento", sub: "env", ...tiempo(300) },
          { id: "vbp", nombre: "Quiebre del volumen", corto: "Quiebre", sub: "env", ...nivel(100) },
          { id: "vst", nombre: "Pendiente del volumen", corto: "Pendiente", sub: "env", ...tiempo(300) },
          { id: "vsl", nombre: "Sostenido del volumen", corto: "Sostenido", sub: "env", ...nivel(100) },
          { id: "vrt", nombre: "Soltado del volumen", corto: "Soltado", sub: "env", ...tiempo(200) },
          { id: "vvs", nombre: "Sensibilidad del volumen", corto: "Sensibilidad", sub: "vel", min: 0, max: 100, defecto: 70, unidad: "%", paso: 1 },
          { id: "vvt", nombre: "Tiempos del volumen por intensidad", corto: "Tiempo", sub: "vel", min: 0, max: 100, defecto: 0, unidad: "%", paso: 1 },
          ...polaridades(k, "vvp", "vel", "Intensidad en los tiempos del volumen"),
          { id: "vkt", nombre: "Tiempos del volumen por tecla", corto: "Tiempo", sub: "tec", min: 0, max: 100, defecto: 0, unidad: "%", paso: 1 },
          ...polaridades(k, "vkp", "tec", "Tecla en los tiempos del volumen")
        ],
        "vol"
      ),
      ...P(
        [
          { id: "ft", nombre: "Tipo de filtro", corto: "Tipo", sub: "capa", tipo: "choice", opciones: TIPOS_FILTRO, defecto: 0, min: 0, max: 3 },
          { id: "fc", nombre: "Corte", sub: "capa", min: 20, max: 2e4, defecto: 2e3, unidad: "Hz", paso: 1, log: true },
          { id: "fr", nombre: "Resonancia", sub: "capa", min: 0, max: 100, defecto: 10, unidad: "%", paso: 1 },
          { id: "fi", nombre: "Intensidad del filtro", corto: "Intensidad", sub: "capa", min: -8, max: 8, defecto: 0, unidad: "oct", paso: 0.05, dec: 2 },
          { id: "fl0", nombre: "Nivel inicial del filtro", corto: "Inicio", sub: "env", ...nivel(0, true) },
          { id: "fat", nombre: "Ataque del filtro", corto: "Ataque", sub: "env", ...tiempo(2) },
          { id: "fal", nombre: "Nivel de ataque del filtro", corto: "Cima", sub: "env", ...nivel(100, true) },
          { id: "fdt", nombre: "Decaimiento del filtro", corto: "Decaimiento", sub: "env", ...tiempo(300) },
          { id: "fbp", nombre: "Quiebre del filtro", corto: "Quiebre", sub: "env", ...nivel(50, true) },
          { id: "fst", nombre: "Pendiente del filtro", corto: "Pendiente", sub: "env", ...tiempo(600) },
          { id: "fsl", nombre: "Sostenido del filtro", corto: "Sostenido", sub: "env", ...nivel(0, true) },
          { id: "frt", nombre: "Soltado del filtro", corto: "Soltado", sub: "env", ...tiempo(200) },
          { id: "frl", nombre: "Nivel final del filtro", corto: "Final", sub: "env", ...nivel(0, true) },
          { id: "fvi", nombre: "Intensidad del filtro por intensidad", corto: "Intensidad", sub: "vel", min: -100, max: 100, defecto: 0, unidad: "%", paso: 1 },
          { id: "fvt", nombre: "Tiempos del filtro por intensidad", corto: "Tiempo", sub: "vel", min: 0, max: 100, defecto: 0, unidad: "%", paso: 1 },
          ...polaridades(k, "fvp", "vel", "Intensidad en los tiempos del filtro"),
          { id: "fkc", nombre: "Corte por tecla", corto: "Corte", sub: "tec", min: -200, max: 200, defecto: 0, unidad: "%", paso: 1 },
          { id: "fkt", nombre: "Tiempos del filtro por tecla", corto: "Tiempo", sub: "tec", min: 0, max: 100, defecto: 0, unidad: "%", paso: 1 },
          ...polaridades(k, "fkp", "tec", "Tecla en los tiempos del filtro")
        ],
        "fil"
      ),
      ...P(
        [
          { id: "pi", nombre: "Intensidad de la altura", corto: "Intensidad", sub: "capa", min: 0, max: 24, defecto: 12, unidad: "st", paso: 0.01, dec: 2 },
          { id: "pl0", nombre: "Nivel inicial de la altura", corto: "Inicio", sub: "env", ...nivel(0, true) },
          { id: "pat", nombre: "Ataque de la altura", corto: "Ataque", sub: "env", ...tiempo(2) },
          { id: "pal", nombre: "Nivel de ataque de la altura", corto: "Cima", sub: "env", ...nivel(0, true) },
          { id: "pdt", nombre: "Decaimiento de la altura", corto: "Decaimiento", sub: "env", ...tiempo(100) },
          { id: "prt", nombre: "Soltado de la altura", corto: "Soltado", sub: "env", ...tiempo(200) },
          { id: "prl", nombre: "Nivel final de la altura", corto: "Final", sub: "env", ...nivel(0, true) },
          { id: "pvi", nombre: "Intensidad de la altura por intensidad", corto: "Intensidad", sub: "vel", min: -100, max: 100, defecto: 0, unidad: "%", paso: 1 },
          { id: "pvt", nombre: "Tiempos de la altura por intensidad", corto: "Tiempo", sub: "vel", min: -100, max: 100, defecto: 0, unidad: "%", paso: 1 }
        ],
        "alt"
      ),
      ...P(
        [
          { id: "smt", nombre: "Modelo", sub: "sop1", tipo: "choice", opciones: MODELOS, defecto: 0, min: 0, max: 2 },
          { id: "sex", nombre: "Extremo del tubo", corto: "Extremo", sub: "sop1", solo: [0], tipo: "choice", opciones: ["Abierto", "Cerrado"], defecto: 0, min: 0, max: 1 },
          { id: "sfo", nombre: "Tubo de la ca\xF1a", corto: "Tubo de la ca\xF1a", sub: "sop1", solo: [2], tipo: "choice", opciones: ["Recto", "C\xF3nico"], defecto: 0, min: 0, max: 1 },
          { id: "stb", nombre: "Largo del tubo", corto: "Largo", sub: "sop1", solo: [1], tipo: "choice", opciones: ["Sigue la nota", "Fijo"], defecto: 0, min: 0, max: 1 },
          { id: "stn", nombre: "Nota del tubo", sub: "sop1", solo: [1], nota: true, min: 24, max: 96, defecto: 36, paso: 1 },
          { id: "sgm", nombre: "Forma del tubo", corto: "Forma", sub: "sop1", solo: [1], tipo: "choice", opciones: ["Simple", "Con medidas"], defecto: 0, min: 0, max: 1 },
          { id: "slm", nombre: "Largo desde", sub: "sop1", solo: [1], tipo: "choice", opciones: ["La nota", "El largo"], defecto: 0, min: 0, max: 1 },
          { id: "slc", nombre: "Largo del tubo recto", corto: "Largo", sub: "sop1", solo: [1], min: 5, max: 800, defecto: 400, unidad: "cm", paso: 0.5, dec: 1 },
          { id: "sdc", nombre: "Di\xE1metro del tubo", corto: "Di\xE1metro", sub: "sop1", solo: [1], min: 3, max: 40, defecto: 20, unidad: "mm", paso: 0.5, dec: 1 },
          { id: "slh", nombre: "Largo del cacho", sub: "sop1", solo: [1], min: 0, max: 80, defecto: 35, unidad: "cm", paso: 0.5, dec: 1 },
          { id: "sdh", nombre: "Boca del cacho", sub: "sop1", solo: [1], min: 5, max: 200, defecto: 90, unidad: "mm", paso: 1 },
          { id: "sfh", nombre: "Curva del cacho", corto: "Curva", sub: "sop1", solo: [1], min: 0, max: 100, defecto: 50, unidad: "%", paso: 1 },
          { id: "spa", nombre: "Pared del tubo", corto: "Pared", sub: "sop1", solo: [1], min: 0, max: 100, defecto: 0, unidad: "%", paso: 1 },
          { id: "scb", nombre: "Cacho blando", corto: "Blando", sub: "sop1", solo: [1], min: 0, max: 100, defecto: 0, unidad: "%", paso: 1 },
          { id: "sen", nombre: "Enrollado", sub: "sop1", solo: [1], tipo: "choice", opciones: ["Recto", "Espiral", "\xD3valo"], defecto: 0, min: 0, max: 2 },
          { id: "svu", nombre: "Vueltas", sub: "sop1", solo: [1], min: 1, max: 12, defecto: 3, paso: 1 },
          { id: "ssn", nombre: "Sentido del aire", corto: "Aire", sub: "sop1", solo: [1], tipo: "choice", opciones: ["Soplado", "Aspirado"], defecto: 0, min: 0, max: 1 },
          { id: "slb", nombre: "Labio", sub: "sop1", solo: [1], tipo: "choice", opciones: ["Simple", "Con flujo de aire"], defecto: 0, min: 0, max: 1 },
          { id: "sbq", nombre: "Boquilla", sub: "sop1", solo: [1], tipo: "choice", opciones: ["Sin boquilla", "Con boquilla"], defecto: 0, min: 0, max: 1 },
          { id: "sbv", nombre: "Copa de la boquilla", corto: "Copa", sub: "sop1", solo: [1], min: 0.2, max: 4, defecto: 1.5, unidad: "cm\xB3", paso: 0.1, dec: 1 },
          { id: "sbg", nombre: "Garganta de la boquilla", corto: "Garganta", sub: "sop1", solo: [1], min: 2, max: 8, defecto: 3.6, unidad: "mm", paso: 0.1, dec: 1 },
          { id: "sbr", nombre: "Bramido", sub: "sop1", solo: [1], min: 0, max: 100, defecto: 0, unidad: "%", paso: 1 },
          { id: "stf", nombre: "Afinaci\xF3n del tubo", corto: "Afinaci\xF3n", sub: "sop1", solo: [1], min: -100, max: 100, defecto: 0, unidad: "ct", paso: 1 },
          { id: "sai", nombre: "Aire", sub: "sop2", min: 0, max: 100, defecto: 60, unidad: "%", paso: 1 },
          { id: "sem", nombre: "Embocadura", sub: "sop2", min: 0, max: 100, defecto: 50, unidad: "%", paso: 1 },
          { id: "sru", nombre: "Ruido de aliento", corto: "Aliento", sub: "sop2", min: 0, max: 100, defecto: 15, unidad: "%", paso: 1 },
          { id: "ssu", nombre: "Subida con el aire", corto: "Subida", sub: "sop2", min: 0, max: 100, defecto: 20, unidad: "ct", paso: 1 },
          { id: "sds", nombre: "Desv\xEDo al sostener", corto: "Desv\xEDo", sub: "sop2", min: -100, max: 100, defecto: 0, unidad: "ct", paso: 1 },
          { id: "sdt", nombre: "Tiempo del desv\xEDo", corto: "Tiempo", sub: "sop2", ...tiempo(300) },
          { id: "sdx", nombre: "Desv\xEDo al final", corto: "Al final", sub: "sop2", min: -200, max: 200, defecto: 0, unidad: "ct", paso: 1 },
          { id: "slg", nombre: "Ligado", sub: "sop2", tipo: "choice", opciones: ["No", "S\xED"], defecto: 0, min: 0, max: 1 },
          { id: "slt", nombre: "Tiempo del ligado", corto: "Paso", sub: "sop2", ...tiempo(60) },
          { id: "sgl", nombre: "Golpe de lengua", corto: "Lengua", sub: "sop2", min: 0, max: 100, defecto: 0, unidad: "%", paso: 1 },
          { id: "srs", nombre: "Respiraci\xF3n", sub: "sop2", min: 0, max: 100, defecto: 0, unidad: "%", paso: 1 },
          { id: "svn", nombre: "Variaci\xF3n entre notas", corto: "Variaci\xF3n", sub: "sop2", min: 0, max: 100, defecto: 0, unidad: "%", paso: 1 },
          { id: "sin", nombre: "Inestabilidad", sub: "sop2", min: 0, max: 50, defecto: 0, unidad: "ct", paso: 1 },
          { id: "siv", nombre: "Velocidad de la inestabilidad", corto: "Velocidad", sub: "sop2", min: 0.5, max: 15, defecto: 5, unidad: "Hz", paso: 0.1, dec: 1 },
          { id: "ssa", nombre: "Salto", sub: "sop2", min: 0, max: 100, defecto: 70, unidad: "%", paso: 1 },
          { id: "sas", nombre: "Aspereza", sub: "sop2", min: 0, max: 100, defecto: 0, unidad: "%", paso: 1 },
          { id: "sgr", nombre: "Gru\xF1ido", sub: "sop2", min: 0, max: 100, defecto: 0, unidad: "%", paso: 1 },
          { id: "sgi", nombre: "Grito", sub: "sop3", min: 0, max: 100, defecto: 0, unidad: "%", paso: 1 },
          { id: "sap", nombre: "Apagado", sub: "sop3", min: 0, max: 100, defecto: 30, unidad: "%", paso: 1 },
          { id: "sca", nombre: "Campana", sub: "sop3", solo: [1], min: 0, max: 100, defecto: 30, unidad: "%", paso: 1 },
          { id: "sbo", nombre: "Resonancia de la boca", corto: "Boca", sub: "sop3", min: 0, max: 100, defecto: 0, unidad: "%", paso: 1 },
          { id: "sf1", nombre: "Primera resonancia de la boca", corto: "Boca 1", sub: "sop3", min: 200, max: 2e3, defecto: 650, unidad: "Hz", paso: 5 },
          { id: "sf2", nombre: "Segunda resonancia de la boca", corto: "Boca 2", sub: "sop3", min: 600, max: 4e3, defecto: 1600, unidad: "Hz", paso: 10 },
          { id: "stc", nombre: "Tercer parcial", corto: "Tercero", sub: "sop3", solo: [1], min: -30, max: 12, defecto: -10, unidad: "dB", paso: 0.5, dec: 1 },
          { id: "sdf", nombre: "Doble fondo", sub: "sop3", solo: [0], min: 0, max: 1200, defecto: 0, unidad: "ct", paso: 1 },
          { id: "sde", nombre: "Entrada del fondo", corto: "Entrada", sub: "sop3", solo: [0], min: 0, max: 100, defecto: 50, unidad: "%", paso: 1 },
          { id: "sfa", nombre: "Fuente del aire", corto: "Aire desde", sub: "sop3", tipo: "choice", opciones: FUENTES_AIRE, defecto: 0, min: 0, max: FUENTES_AIRE.length - 1 }
        ],
        "sop"
      ),
      ...P(
        [
          { id: "mhm", nombre: "Realce de arm\xF3nicos", corto: "Realce", sub: "mdf1", min: 0, max: 100, defecto: 0, unidad: "%", paso: 1 },
          { id: "mhi", nombre: "\xCDndice del realce", corto: "\xCDndice", sub: "mdf1", min: 0, max: 100, defecto: 30, unidad: "%", paso: 1 },
          { id: "mhz", nombre: "Raz\xF3n del realce", corto: "Raz\xF3n", sub: "mdf1", min: 0.5, max: 8, defecto: 2, paso: 0.01, dec: 2 },
          { id: "mrm", nombre: "Resonador", sub: "mdf2", min: 0, max: 100, defecto: 0, unidad: "%", paso: 1 },
          { id: "mrf", nombre: "Realimentaci\xF3n del resonador", corto: "Realimentaci\xF3n", sub: "mdf2", min: 0, max: 99, defecto: 70, unidad: "%", paso: 1 },
          { id: "mrz", nombre: "Raz\xF3n del resonador", corto: "Raz\xF3n", sub: "mdf2", min: 0.25, max: 4, defecto: 1, paso: 0.01, dec: 2 },
          { id: "mcm", nombre: "Cuerpo", sub: "mdf3", min: 0, max: 100, defecto: 0, unidad: "%", paso: 1 },
          { id: "mct", nombre: "Tama\xF1o del cuerpo", corto: "Tama\xF1o", sub: "mdf3", min: 0.5, max: 2, defecto: 1, paso: 0.01, dec: 2 },
          { id: "mcy", nombre: "Tipo de cuerpo", corto: "Tipo", sub: "mdf3", tipo: "choice", opciones: CUERPOS, defecto: 0, min: 0, max: CUERPOS.length - 1 }
        ],
        "mdf"
      )
    ];
  };
  const PARAMS = [
    { id: "vol", nombre: "Volumen", grupo: "general", min: -60, max: 6, defecto: 0, unidad: "dB", paso: 0.1, dec: 1 },
    { id: "afinar", nombre: "Afinaci\xF3n", grupo: "general", min: -24, max: 24, defecto: 0, unidad: "st", paso: 0.01, dec: 2 },
    { id: "gat", nombre: "Ataque general", corto: "Ataque", grupo: "general", min: -50, max: 50, defecto: 0, paso: 1 },
    { id: "gdt", nombre: "Decaimiento general", corto: "Decaimiento", grupo: "general", min: -50, max: 50, defecto: 0, paso: 1 },
    { id: "grt", nombre: "Soltado general", corto: "Soltado", grupo: "general", min: -50, max: 50, defecto: 0, paso: 1 },
    { id: "dist", nombre: "Distorsi\xF3n", grupo: "color", min: 0, max: 36, defecto: 0, unidad: "dB", paso: 0.5, dec: 1 },
    { id: "dmez", nombre: "Mezcla de la distorsi\xF3n", corto: "Mezcla", grupo: "color", min: 0, max: 100, defecto: 100, unidad: "%", paso: 1 },
    { id: "ruido", nombre: "Ruido", grupo: "color", min: 0, max: 100, defecto: 0, unidad: "%", paso: 1 },
    { id: "desaf", nombre: "Desafinado", grupo: "color", min: 0, max: 100, defecto: 0, unidad: "ct", paso: 1 },
    { id: "sub", nombre: "Sub", grupo: "color", min: 0, max: 100, defecto: 0, unidad: "%", paso: 1 },
    { id: "subOct", nombre: "Octava del sub", corto: "Octava", grupo: "color", tipo: "choice", opciones: ["\u22121", "\u22122"], defecto: 0, min: 0, max: 1 },
    { id: "subForma", nombre: "Forma del sub", corto: "Forma", grupo: "color", tipo: "choice", opciones: ["Seno", "Cuadrada"], defecto: 0, min: 0, max: 1 },
    ...vaiven(1),
    ...vaiven(2),
    ...capa(1),
    ...capa(2),
    ...capa(3)
  ];
  const VOCES = 32;
  const CRUCE_S = 4e-3;
  const AHOGO_S = 6e-3;
  const BORDE_S = 2e-3;
  const CADA = 16;
  const dB = (x) => Math.pow(10, x / 20);
  const val = (p, id, def) => p[id] === void 0 ? def : p[id];
  const POL = [1, 0, -1];
  const porTiempo = (pol, cant, x) => Math.pow(2, POL[Math.round(pol)] * cant * x * 3);
  const C_AIRE = 343;
  const MAXH = 256;
  const cacheGeo = /* @__PURE__ */ new Map();
  const geometria = (g, fm) => {
    const clave = `${g.sdc}|${g.slh}|${g.sdh}|${g.sfh}|${g.sen}|${g.svu}|${g.spa}|${g.scb}|${fm}`;
    let G = cacheGeo.get(clave);
    if (G) return G;
    const rc = Math.max(15e-4, g.sdc / 2e3);
    const Lh = Math.max(0, g.slh / 100);
    const rb = Math.max(rc, g.sdh / 2e3);
    const gam = 1 + 3 * g.sfh / 100;
    const M = Math.min(MAXH, Math.round(Lh * fm / C_AIRE));
    const A = new Float64Array(M + 1);
    A[0] = rc * rc;
    let rMed = 0;
    for (let i = 0; i < M; i++) {
      const r = rc + (rb - rc) * Math.pow((i + 0.5) / M, gam);
      A[i + 1] = r * r;
      rMed += r / M;
    }
    const K = new Float64Array(Math.max(1, M));
    for (let i = 0; i < M; i++) K[i] = (A[i] - A[i + 1]) / (A[i] + A[i + 1]);
    const rBoca = M > 0 ? Math.sqrt(A[M]) : rc;
    const fcB = Math.min(0.4 * fm, 1.2 * C_AIRE / (2 * Math.PI * rBoca));
    const vueltas = g.sen >= 0.5 ? g.svu : 0;
    G = { M, K, rc, Lh, rMed: rMed || rc, fPared: 1 + 5 * (g.spa || 0) / 100, fBlando: 1 + 10 * (g.scb || 0) / 100, pB: Math.exp(-2 * Math.PI * fcB / fm), enrollado: 1 - vueltas * (g.sen >= 1.5 ? 6e-3 : 4e-3), picos: /* @__PURE__ */ new Map() };
    if (cacheGeo.size > 64) cacheGeo.clear();
    cacheGeo.set(clave, G);
    return G;
  };
  const respuestaCacho = (G, th) => {
    const cr = Math.cos(th);
    const ci = -Math.sin(th);
    let dr = 1 - G.pB * cr;
    let di = -G.pB * ci;
    let d2 = dr * dr + di * di;
    let Rr = -0.99 * (1 - G.pB) * dr / d2;
    let Ri = 0.99 * (1 - G.pB) * di / d2;
    const c2 = Math.cos(2 * th);
    const s2 = -Math.sin(2 * th);
    for (let i = G.M; i >= 1; i--) {
      const tr = Rr * c2 - Ri * s2;
      const ti = Rr * s2 + Ri * c2;
      const k = G.K[i - 1];
      const nr = k + tr;
      const ni = ti;
      dr = 1 + k * tr;
      di = k * ti;
      d2 = dr * dr + di * di;
      Rr = (nr * dr + ni * di) / d2;
      Ri = (ni * dr - nr * di) / d2;
    }
    return [Rr, Ri];
  };
  const perdidas = (G, Lc, fm) => {
    const Kp = 296e-7 * 2 * G.fPared * (Lc / G.rc + G.Lh / G.rMed * G.fBlando);
    const gf = (f) => Math.exp(-Kp * Math.sqrt(f)) * G.enrollado;
    const f2 = Math.min(1500, 0.2 * fm);
    const g0 = gf(30);
    const rho = Math.min(0.9999, gf(f2) / g0);
    const th = 2 * Math.PI * f2 / fm;
    const a = 1 - rho * rho;
    const b = 1 - rho * rho * Math.cos(th);
    const p = a < 1e-9 ? 0 : (b - Math.sqrt(Math.max(0, b * b - a * a))) / a;
    return { g0, p };
  };
  const fasePerdida = (p, th) => -Math.atan2(p * Math.sin(th), 1 - p * Math.cos(th));
  const largoPara = (G, f, N0, fm, extra = 0) => {
    const th = 2 * Math.PI * f / fm;
    const [Rr, Ri] = respuestaCacho(G, th);
    const L = perdidas(G, Math.max(2, N0) * C_AIRE / fm, fm);
    const fi = Math.atan2(Ri, Rr) + fasePerdida(L.p, th) + Math.PI + extra;
    let m = Math.round((2 * th * N0 - fi) / (2 * Math.PI));
    let N2 = (fi + 2 * Math.PI * m) / (2 * th);
    while (N2 < 2) N2 += Math.PI / th;
    return N2;
  };
  const RESTO_FLUJO = (k, aspira) => aspira ? 110 : 0;
  const boquilla = (g, fm) => {
    if (!(g.sgm >= 0.5 && g.sbq >= 0.5)) return null;
    const A = Math.PI * Math.pow(g.sbg / 2e3, 2);
    const f = Math.min(0.4 * fm, C_AIRE / (2 * Math.PI) * Math.sqrt(A / (g.sbv * 1e-6 * 0.025)));
    const w0 = 2 * Math.PI * f / fm;
    const al = Math.sin(w0) / 4;
    const a0 = 1 + al;
    const co = Math.cos(w0);
    return { f, b0: (1 - co) / 2 / a0, b1: (1 - co) / a0, b2: (1 - co) / 2 / a0, a1: -2 * co / a0, a2: (1 - al) / a0 };
  };
  const respBoq = (B, th) => {
    if (!B) return [1, 0];
    const nr = B.b0 + B.b1 * Math.cos(th) + B.b2 * Math.cos(2 * th);
    const ni = -(B.b1 * Math.sin(th) + B.b2 * Math.sin(2 * th));
    const dr = 1 + B.a1 * Math.cos(th) + B.a2 * Math.cos(2 * th);
    const di = -(B.a1 * Math.sin(th) + B.a2 * Math.sin(2 * th));
    const d2 = dr * dr + di * di;
    return [(nr * dr + ni * di) / d2, (ni * dr - nr * di) / d2];
  };
  const cortarTubo = (G, meta, k, paso, fL, aspira, fm, B = null, flujo = false) => {
    const N0 = fm / (2 * paso) - G.M;
    const th = 2 * Math.PI * meta / fm;
    const wL = 2 * Math.PI * Math.min(0.2 * fm, fL) / fm;
    const rr = 1 - Math.PI * 0.6 * paso / fm;
    const a1 = -2 * rr * Math.cos(wL);
    const a2 = rr * rr;
    const fLab = -Math.atan2(-(a1 * Math.sin(th) + a2 * Math.sin(2 * th)), 1 + a1 * Math.cos(th) + a2 * Math.cos(2 * th));
    const resto = Math.pow(2, (flujo ? RESTO_FLUJO(k, aspira) : -(8 + 90 / (k * k)) + (aspira ? 65 : 0)) / 1200);
    const [hr, hi] = respBoq(B, 2 * Math.PI * meta * resto / fm);
    return largoPara(G, meta * resto, N0, fm, -fLab + Math.atan2(hi, hr));
  };
  const resonancias = (G, Nc, fm, B = null) => {
    const clave = `${Math.round(Nc * 100)}|${B ? Math.round(B.f) : 0}`;
    let P = G.picos.get(clave);
    if (P) return P;
    const L = perdidas(G, Nc * C_AIRE / fm, fm);
    const fmax = Math.min(3e3, 0.3 * fm);
    const z = [];
    for (let f = 15; f <= fmax; f += 1) {
      const th = 2 * Math.PI * f / fm;
      let [Rr, Ri] = respuestaCacho(G, th);
      if (B) {
        const [hr, hi] = respBoq(B, th);
        [Rr, Ri] = [Rr * hr - Ri * hi, Rr * hi + Ri * hr];
      }
      const fase = -2 * th * Nc + fasePerdida(L.p, th);
      const mag = L.g0 * (1 - L.p) / Math.hypot(1 - L.p * Math.cos(th), L.p * Math.sin(th));
      const cr = Math.cos(fase) * mag;
      const ci = Math.sin(fase) * mag;
      const r = -(Rr * cr - Ri * ci);
      const i = -(Rr * ci + Ri * cr);
      z.push(Math.hypot(1 + r, i) / Math.max(1e-9, Math.hypot(1 - r, i)));
    }
    P = [];
    for (let j = 1; j < z.length - 1; j++)
      if (z[j] > z[j - 1] && z[j] >= z[j + 1] && z[j] > 2) {
        const d = z[j - 1] - 2 * z[j] + z[j + 1];
        P.push(15 + j + (d < 0 ? 0.5 * (z[j - 1] - z[j + 1]) / d : 0));
      }
    if (G.picos.size > 32) G.picos.clear();
    G.picos.set(clave, P);
    return P;
  };
  const medidaTubo = (g, fm = 48e3) => {
    const G = geometria(g, fm);
    const B = boquilla(g, fm);
    if (g.slm >= 0.5) {
      const Nc2 = g.slc / 100 * fm / C_AIRE;
      const P = resonancias(G, Nc2, fm, B);
      if (P.length < 7) return { hz: 0, cm: g.slc };
      const paso = (P[3] - P[1]) / 2;
      return { hz: (P[5] + 0.21 * paso) / 6, cm: g.slc };
    }
    const fT = 440 * Math.pow(2, (g.stn - 69 + g.stf / 100) / 12);
    const Nc = cortarTubo(G, 6 * fT, 6, fT, 6 * fT, g.ssn >= 0.5, fm, B, g.slb >= 0.5);
    return { hz: fT, cm: Nc * C_AIRE / fm * 100 };
  };
  function crear(fm) {
    const muestras = /* @__PURE__ */ new Map();
    let zonas = [];
    const voces = [];
    let orden = 0;
    const lfo = [
      { fase: 0, azar: 0 },
      { fase: 0, azar: 0 }
    ];
    let semilla = 22222;
    const azar = () => {
      semilla = semilla * 1664525 + 1013904223 >>> 0;
      return semilla / 2147483648 - 1;
    };
    let mVol = new Float32Array(128);
    let mFil = new Float32Array(128);
    let mDis = new Float32Array(128);
    let mPan = new Float32Array(128);
    const prepararCapa = (c0, tajada = -1, nota = -1) => {
      const c = tajada < 0 && c0.var && c0.var[nota] ? { ...c0, ...c0.var[nota] } : c0;
      if (c.mod && typeof c.mod === "object") {
        const pan2 = Math.max(-1, Math.min(1, Number(c.pan) || 0));
        const ang2 = (pan2 + 1) * Math.PI / 4;
        return {
          mod: true,
          gL: dB(Number(c.gan) || 0) * Math.cos(ang2),
          gR: dB(Number(c.gan) || 0) * Math.sin(ang2),
          afinar: Number(c.afinar) || 0
        };
      }
      if (c.osc && typeof c.osc === "object") {
        const pan2 = Math.max(-1, Math.min(1, Number(c.pan) || 0));
        const ang2 = (pan2 + 1) * Math.PI / 4;
        return {
          osc: true,
          forma: Math.max(0, Math.min(3, Math.round(Number(c.osc.forma) || 0))),
          ancho: Math.max(0.05, Math.min(0.95, (Number(c.osc.ancho) || 50) / 100)),
          gL: 0.5 * dB(Number(c.gan) || 0) * Math.cos(ang2),
          gR: 0.5 * dB(Number(c.gan) || 0) * Math.sin(ang2),
          afinar: Number(c.afinar) || 0
        };
      }
      const mu = muestras.get(c.m);
      if (!mu || !mu.c.length || !mu.c[0].length) return null;
      const largo = mu.c[0].length;
      const s = (x) => Math.max(0, Math.min(largo - 1, Math.round((Number(x) || 0) * mu.fm)));
      const pan = Math.max(-1, Math.min(1, Number(c.pan) || 0));
      const ang = (pan + 1) * Math.PI / 4;
      const comun = {
        mu,
        gL: dB(Number(c.gan) || 0) * Math.cos(ang),
        gR: dB(Number(c.gan) || 0) * Math.sin(ang),
        afinar: Number(c.afinar) || 0
      };
      if (tajada >= 0) {
        const cortes = Array.isArray(c.cortes) ? c.cortes : [];
        if (tajada >= cortes.length) return null;
        const ini2 = s(cortes[tajada]);
        const finTodo = c.fin === void 0 || c.fin === null ? largo - 1 : s(c.fin);
        const fin2 = tajada + 1 < cortes.length ? Math.min(finTodo, s(cortes[tajada + 1])) : finTodo;
        if (fin2 - ini2 < 2) return null;
        return {
          ...comun,
          ini: ini2,
          lIni: fin2,
          lFin: fin2,
          fin: fin2,
          loop: false,
          alt: [false, false, false],
          cruce: 1,
          borde: Math.max(1, Math.min(Math.floor((fin2 - ini2) / 2), Math.round(BORDE_S * mu.fm)))
        };
      }
      const fin = c.fin === void 0 || c.fin === null ? largo - 1 : s(c.fin);
      const ini = Math.min(s(c.ini), fin);
      let lIni = c.lIni === void 0 || c.lIni === null ? ini : Math.max(ini, s(c.lIni));
      let lFin = c.lFin === void 0 || c.lFin === null ? fin : Math.min(fin, s(c.lFin));
      if (lFin < lIni) lFin = lIni;
      const loop = !!c.loop && lFin - lIni > 2;
      if (!loop) {
        lIni = Math.min(lIni, fin);
        lFin = Math.min(lFin, fin);
      }
      const alt = Array.isArray(c.alt) ? [c.alt[0] !== false, c.alt[1] !== false, c.alt[2] !== false] : [true, true, true];
      return {
        ...comun,
        ini,
        lIni,
        lFin,
        fin,
        loop,
        alt,
        cruce: Math.max(1, Math.min(Math.floor((lFin - lIni) / 2), Math.round(CRUCE_S * mu.fm))),
        borde: 0
      };
    };
    const leer = (canal, pos) => {
      const i = pos | 0;
      const f = pos - i;
      const a = canal[i];
      const b = i + 1 < canal.length ? canal[i + 1] : a;
      return a + (b - a) * f;
    };
    const cabeza = (c, canal, pos, enLoop) => {
      if (!enLoop && !c.borde) return leer(canal, pos);
      let x = leer(canal, pos);
      if (enLoop && pos >= c.lIni && pos < c.lFin && pos > c.lFin - c.cruce) {
        const a = (pos - (c.lFin - c.cruce)) / c.cruce;
        x = x * (1 - a) + leer(canal, pos - (c.lFin - c.lIni)) * a;
      }
      if (c.borde) {
        const d = Math.min(pos - c.ini, c.fin - pos);
        if (d < c.borde) x *= Math.max(0, d) / c.borde;
      }
      return x;
    };
    const parteDe = (c, pos) => pos < c.lIni ? 0 : pos < c.lFin ? 1 : 2;
    const MAXL = 8192;
    const lineaS = () => ({ b: new Float32Array(MAXL), i: 0 });
    const leerS = (l, d) => {
      let q = l.i - Math.max(1, Math.min(MAXL - 2, d));
      if (q < 0) q += MAXL;
      const i0 = q | 0;
      const f = q - i0;
      return l.b[i0] * (1 - f) + l.b[i0 + 1 & MAXL - 1] * f;
    };
    const ponerS = (l, x) => {
      l.b[l.i] = x;
      l.i = l.i + 1 & MAXL - 1;
    };
    const nuevoSoplo = () => ({ a: lineaS(), b: lineaS(), j: lineaS(), k: lineaS(), lpA: 0, lpB: 0, dx: 0, dy: 0, y1: 0, y2: 0, z1: 0, cx: 0, gfase: 0, q1: 0, q2: 0, q3: 0, q4: 0, op: 0, uf: 0, ev: 0, m1: 0, m2: 0, m3: 0, m4: 0, nl: 0, nh: 0, na: 0, na1: [0, 0, 0, 0], na2: [0, 0, 0, 0], b1: [0, 0, 0, 0], b2: [0, 0, 0, 0], rl: [0, 0, 0, 0] });
    const CAL = [1.0195, 1.07, 1.009, 1.025];
    const CONTROL_DE = [null, "rueda", "aliento", "expresion", "presion"];
    const vivo = {};
    const suave = (x) => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
    const soplar = (st, M, p) => {
      if (M.gru > 0) {
        st.gfase += 28 / fm;
        if (st.gfase >= 1) st.gfase -= 1;
        p *= 1 + M.gru * 0.5 * Math.sin(2 * Math.PI * st.gfase);
      }
      const rn = azar();
      p *= M.resp * (1 + 1.5 * M.gp) * M.dip;
      p += (M.aspira ? st.na * 3.2 * 0.3 : rn) * (M.ruido * 0.12 + M.asp * 0.25) * p;
      let pul = 0.5;
      let y;
      if (M.tipo === 0) {
        st.lpA = (1 - M.ap) * leerS(st.a, M.N) + M.ap * st.lpA;
        let t2 = -st.lpA;
        if (M.w2 > 0) {
          st.lpB = (1 - M.ap) * leerS(st.b, M.N2) + M.ap * st.lpB;
          t2 = (t2 - st.lpB * M.w2) / (1 + M.w2);
        }
        const z = t2 - st.dx + 0.995 * st.dy;
        st.dx = t2;
        st.dy = z;
        let pd = p - 0.5 * z;
        ponerS(st.j, pd);
        pd = leerS(st.j, M.J) * (1 + M.gri * 2);
        let x = pd * (pd * pd - 1);
        if (x > 1) x = 1;
        else if (x < -1) x = -1;
        pul = Math.min(1, Math.abs(x));
        x += 0.5 * z;
        ponerS(st.a, x);
        if (M.w2 > 0) ponerS(st.b, x);
        y = 0.3 * x;
        if (M.cerrado) {
          ponerS(st.k, y);
          y = 0.7 * (y - leerS(st.k, M.medio));
        }
      } else if (M.tipo === 1) {
        const boca = (M.aspira ? -0.3 : 0.3) * p;
        if (M.med) st.lpA = M.lg * leerS(st.b, M.Nc) + M.lp * st.lpA;
        else {
          const x = leerS(st.a, Math.max(2, M.N - M.br * st.ev));
          st.ev = x;
          st.lpA = (1 - M.ap * 0.5) * x + M.ap * 0.5 * st.lpA;
        }
        const tubo = M.med ? st.lpA : 0.85 * st.lpA;
        let q;
        if (M.flujo) {
          const dp = boca - (tubo + st.op);
          const yy = M.b0 * dp - M.a1 * st.y1 - M.a2 * st.y2;
          st.y2 = st.y1;
          st.y1 = yy;
          let h = 0.05 + (M.aspira ? -yy : yy) * (1 + M.gri * 2);
          if (h < 0) h = 0;
          if (h > 2) h = 2;
          st.uf += M.ul * (h * Math.sqrt(Math.abs(dp)) * (dp < 0 ? -1 : 1) - st.uf);
          q = tubo + st.uf;
          st.op = q;
          pul = Math.min(1, h);
        } else {
          let dd = boca - tubo;
          const yy = M.b0 * dd - M.a1 * st.y1 - M.a2 * st.y2;
          st.y2 = st.y1;
          st.y1 = yy;
          dd = yy * yy * (1 + M.gri * 3);
          dd = dd / (1 + dd);
          q = dd * boca + (1 - dd) * tubo;
          pul = dd;
        }
        let z = q - st.dx + 0.995 * st.dy;
        st.dx = q;
        st.dy = z;
        if (M.B) {
          const B = M.B;
          const o = B.b0 * z + B.b1 * st.m1 + B.b2 * st.m2 - B.a1 * st.m3 - B.a2 * st.m4;
          st.m2 = st.m1;
          st.m1 = z;
          st.m4 = st.m3;
          st.m3 = o;
          z = o;
        }
        ponerS(st.a, M.med ? -z : z);
        if (M.med) {
          const G = M.G;
          const hf = st.hf || (st.hf = new Float64Array(MAXH + 1));
          const hb = st.hb || (st.hb = new Float64Array(MAXH + 1));
          let entra = leerS(st.a, Math.max(2, M.Nc + M.br * st.ev));
          st.ev = entra;
          let llega;
          if (G.M === 0) llega = entra;
          else {
            for (let i = 0; i < G.M; i++) {
              const k = G.K[i];
              const der = hb[i];
              const viejo = hf[i];
              hf[i] = (1 + k) * entra - k * der;
              const izq = k * entra + (1 - k) * der;
              if (i === 0) ponerS(st.b, izq);
              else hb[i - 1] = izq;
              entra = viejo;
            }
            llega = entra;
          }
          st.cx = G.pB * st.cx + (1 - G.pB) * llega;
          const vuelve = -0.99 * st.cx;
          if (G.M === 0) ponerS(st.b, vuelve);
          else hb[G.M - 1] = vuelve;
          y = 4 * ((1 - M.camp) * st.lpA + M.camp * 5 * (llega + vuelve));
          {
            const F = M.radLP;
            const e = st.rl;
            const o = F[0] * y + F[1] * e[0] + F[2] * e[1] - F[3] * e[2] - F[4] * e[3];
            e[1] = e[0];
            e[0] = y;
            e[3] = e[2];
            e[2] = o;
            y = o;
          }
        } else {
          st.cx = 0.9 * st.cx + 0.1 * z;
          y = 4 * (z - M.camp * 0.8 * st.cx);
        }
        if (M.tc) {
          const o = M.t0 * y + M.t1 * st.q1 + M.t2 * st.q2 - M.t1 * st.q3 - M.t4 * st.q4;
          st.q2 = st.q1;
          st.q1 = y;
          st.q4 = st.q3;
          st.q3 = o;
          y = o;
        }
      } else if (!M.conico) {
        const x = leerS(st.a, M.N);
        const lp = 0.5 * (x + st.z1);
        st.z1 = x;
        st.lpA = (1 - M.ap * 0.5) * lp + M.ap * 0.5 * st.lpA;
        const pd = -0.95 * st.lpA - p;
        let ca\u00F1a = 0.7 + M.pend * pd;
        if (ca\u00F1a > 1) ca\u00F1a = 1;
        else if (ca\u00F1a < -1) ca\u00F1a = -1;
        pul = Math.abs(ca\u00F1a);
        const q = p + pd * ca\u00F1a;
        ponerS(st.a, q);
        const z = q - st.dx + 0.995 * st.dy;
        st.dx = q;
        st.dy = z;
        y = 0.8 * z;
      } else {
        st.lpA = (1 - M.ap * 0.5) * leerS(st.a, M.N) + M.ap * 0.5 * st.lpA;
        const temp = -0.95 * st.lpA;
        const ultimo = temp - leerS(st.b, M.N2);
        const pd = p - ultimo;
        let ca\u00F1a = 0.7 + 0.3 * (1 + M.gri) * pd;
        if (ca\u00F1a > 1) ca\u00F1a = 1;
        else if (ca\u00F1a < -1) ca\u00F1a = -1;
        pul = Math.abs(ca\u00F1a);
        ponerS(st.b, temp);
        ponerS(st.a, p - pd * ca\u00F1a - temp);
        const z = ultimo - st.dx + 0.995 * st.dy;
        st.dx = ultimo;
        st.dy = z;
        y = 0.5 * z;
      }
      st.nl += M.nLp * (rn - st.nl);
      st.nh += M.nHp * (st.nl - st.nh);
      let ru = (st.nl - st.nh) * 2.2 * M.ruido * (1 + 1.5 * M.ruido) * 0.04 * M.env * (1 + 3 * M.gp);
      if (M.aspira) {
        let u = (st.nl - st.nh) * (0.05 + 2.5 * pul * pul);
        for (const [F, e] of [[M.nAH, st.na1], [M.nAL, st.na2]]) {
          const o = F[0] * u + F[1] * e[0] + F[2] * e[1] - F[3] * e[2] - F[4] * e[3];
          e[1] = e[0];
          e[0] = u;
          e[3] = e[2];
          e[2] = o;
          u = o;
        }
        st.na = u;
        ru = u * 3.2 * M.ruido * (1 + 1.5 * M.ruido) * 0.04 * M.env * (1 + 3 * M.gp);
      } else ru *= 0.3 + 1.4 * pul;
      let sal = y + ru;
      if (M.boca) {
        for (let j = 0; j < 2; j++) {
          const F = M.bocaF[j];
          const e = j === 0 ? st.b1 : st.b2;
          const o = F[0] * sal + F[1] * e[0] + F[2] * e[1] - F[1] * e[2] - F[3] * e[3];
          e[1] = e[0];
          e[0] = sal;
          e[3] = e[2];
          e[2] = o;
          sal = o;
        }
        sal *= M.bocaG;
      }
      return sal;
    };
    const prepararSoplo = (cap, g, v2, st, nivel2) => {
      const M = cap.M || (cap.M = {});
      const nombre = CONTROL_DE[Math.round(g.sfa)];
      const ctl = nombre && vivo[nombre] !== void 0 ? vivo[nombre] : 1;
      const sens = Math.max(0, Math.min(1, g.vvs / 100));
      if (cap.vCt === void 0) {
        cap.vCt = azar() * 0.15 * g.svn;
        cap.vA = 1 + azar() * 12e-4 * g.svn;
      }
      M.resp = 1;
      if (g.srs > 0) {
        const cR = 1 - Math.exp(-2 * Math.PI * 1.2 * CADA / fm);
        cap.rr = (cap.rr || 0) + cR * (azar() * 1.732 - (cap.rr || 0));
        M.resp = Math.max(0.6, Math.min(1.4, 1 + 0.12 * g.srs * cap.rr / 100 / Math.sqrt(cR / (2 - cR))));
      }
      const a = Math.max(0, Math.min(1.5, g.sai / 100 * (1 - sens + sens * v2.vel / 127) * ctl * cap.vA * M.resp));
      const emb = g.sem / 100;
      const salto = g.ssa / 100;
      cap.tS = (cap.tS || 0) + CADA;
      M.gp = g.sgl / 100 * Math.exp(-cap.tS / (0.015 * fm));
      if (cap.notaAnt !== void 0 && cap.notaAnt !== v2.nota) cap.tL = 0;
      cap.notaAnt = v2.nota;
      if (cap.tL !== void 0) cap.tL += CADA;
      M.dip = cap.tL !== void 0 ? 1 - 0.6 * Math.exp(-cap.tL / (0.015 * fm)) : 1;
      let des = g.sds * suave(cap.tS / Math.max(1, g.sdt / 1e3 * fm)) + cap.vCt;
      if (v2.soltada && g.sdx) {
        if (!cap.n0) cap.n0 = Math.max(1e-4, nivel2);
        des += g.sdx * (1 - Math.min(1, nivel2 / cap.n0));
      }
      if (g.sin > 0) {
        const cI = 1 - Math.exp(-2 * Math.PI * g.siv * CADA / fm);
        cap.ri = (cap.ri || 0) + cI * (azar() * 1.732 - (cap.ri || 0));
        des += g.sin * cap.ri / Math.sqrt(cI / (2 - cI));
      }
      const stTecla = v2.nota - 69 + cap.c.afinar + st;
      const stN = stTecla + (g.ssu * a + des) / 100;
      const fN = 440 * Math.pow(2, stN / 12);
      cap.fN = fN;
      M.tipo = Math.round(g.smt);
      M.env = nivel2;
      M.ap = 0.05 + 0.85 * (g.sap / 100);
      M.ruido = g.sru / 100;
      M.asp = g.sas / 100;
      M.aspira = false;
      M.gru = g.sgr / 100;
      M.gri = g.sgi / 100;
      M.camp = g.sca / 100;
      M.br = g.sbr / 100 * 60 * a * a;
      M.nLp = 1 - Math.exp(-2 * Math.PI * Math.min(5e3, 0.4 * fm) / fm);
      if (!M.nAH || M.nAfm !== fm) {
        M.nAfm = fm;
        const bq = (f, alto) => {
          const w0 = 2 * Math.PI * Math.min(f, 0.45 * fm) / fm;
          const al = Math.sin(w0) / (2 * 0.707);
          const co = Math.cos(w0);
          const a0 = 1 + al;
          return alto ? [(1 + co) / 2 / a0, -(1 + co) / a0, (1 + co) / 2 / a0, -2 * co / a0, (1 - al) / a0] : [(1 - co) / 2 / a0, (1 - co) / a0, (1 - co) / 2 / a0, -2 * co / a0, (1 - al) / a0];
        };
        M.nAH = bq(600, true);
        M.nAL = bq(3e3, false);
        M.radLP = bq(9e3, false);
      }
      M.nHp = 1 - Math.exp(-2 * Math.PI * 500 / fm);
      M.aspiraG = Math.round(g.smt) === 1 && g.sgm >= 0.5 && g.ssn >= 0.5;
      M.boca = g.sbo > 0;
      if (M.boca) {
        const cant = g.sbo / 100 * (M.aspiraG ? 1 : 0.5);
        const clave = `${g.sf1}|${g.sf2}|${cant}`;
        if (cap.bocaClave !== clave) {
          cap.bocaClave = clave;
          const pico = (f, dB2, Q) => {
            const A = Math.pow(10, dB2 / 40);
            const w0 = 2 * Math.PI * Math.min(f, 0.45 * fm) / fm;
            const al = Math.sin(w0) / (2 * Q);
            const a0 = 1 + al / A;
            return [(1 + al * A) / a0, -2 * Math.cos(w0) / a0, (1 - al * A) / a0, (1 - al / A) / a0];
          };
          cap.bocaF = [pico(g.sf1, 15 * cant, 2), pico(g.sf2, 8 * cant, 2.5)];
          cap.bocaG = Math.pow(10, -7 * cant / 20);
        }
        M.bocaF = cap.bocaF;
        M.bocaG = cap.bocaG;
      }
      if (M.tipo === 0) {
        M.cerrado = g.sex >= 0.5;
        const f = fN / CAL[0];
        let N2 = 1.5 * fm / f - 2;
        const jr = (0.42 - 0.12 * emb) * (1 - (1 - salto) * 0.55 * Math.max(0, a - 0.3));
        M.N = N2;
        M.medio = 0.5 * fm / fN;
        M.J = N2 * jr * (1 + M.asp * 0.08 * azar());
        M.N2 = g.sdf > 0 ? N2 * Math.pow(2, g.sdf / 1200) : 0;
        M.w2 = g.sdf > 0 ? suave((a - g.sde / 100) / 0.15 + 0.5) : 0;
        M.pb = 0.6 + 0.8 * Math.min(1, a);
      } else if (M.tipo === 1) {
        const labio = Math.pow(2, ((emb - 0.5) * 6 + (1 - salto) * 4 * Math.max(0, a - 0.5)) / 12);
        let fL;
        M.med = g.sgm >= 0.5;
        M.aspira = M.med && g.ssn >= 0.5;
        M.flujo = M.med && g.slb >= 0.5;
        M.ul = 1 - Math.exp(-2 * Math.PI * Math.min(0.45 * fm, 430 * (1 + 15 * Math.pow(Math.max(0, a - 0.4), 2))) / fm);
        M.B = boquilla(g, fm);
        if (M.med) {
          const G = geometria(g, fm);
          M.G = G;
          const fTecla = 440 * Math.pow(2, stTecla / 12);
          let meta;
          let paso2;
          if (g.stb >= 0.5 && g.slm >= 0.5) {
            const Nc = g.slc / 100 * fm / C_AIRE * Math.pow(2, -des / 1200);
            const P = resonancias(G, Nc / Math.pow(2, -des / 1200), fm, M.B);
            paso2 = P.length > 3 ? (P[3] - P[1]) / 2 : fTecla / 3;
            let mejor = P.length > 1 ? P[1] : P[0] || fTecla;
            for (let j = 2; j < P.length; j++) if (Math.abs(Math.log((P[j] + 0.21 * paso2) / fTecla)) < Math.abs(Math.log((mejor + 0.21 * paso2) / fTecla))) mejor = P[j];
            meta = (mejor + 0.21 * paso2) * Math.pow(2, des / 1200);
            M.Nc = Nc;
          } else {
            let fT;
            let k;
            if (g.stb >= 0.5) {
              fT = 440 * Math.pow(2, (g.stn - 69 + g.stf / 100 + st) / 12);
              k = Math.max(2, Math.round(fTecla / fT));
            } else {
              k = 3;
              fT = fN / k;
            }
            meta = g.stb >= 0.5 ? k * fT * Math.pow(2, des / 1200) : fN;
            paso2 = meta / k;
            const fLm = meta * Math.pow(2, g.ssu * a / 1200) * labio * (M.aspira ? Math.pow(2, -1 / 12) : 1) * (M.flujo ? 1 - (0.15 + 0.5 * Math.exp(-cap.tS / (0.05 * fm))) * paso2 / meta : 1);
            const claveM = `${meta}|${fLm}|${paso2}|${M.aspira}|${M.B ? M.B.f : 0}|${M.flujo}`;
            if (cap.medMeta !== claveM || cap.medG !== G) {
              cap.medMeta = claveM;
              cap.medG = G;
              cap.medN = cortarTubo(G, meta, k, paso2, fLm, M.aspira, fm, M.B, M.flujo);
            }
            M.Nc = cap.medN;
          }
          const L = perdidas(G, M.Nc * C_AIRE / fm, fm);
          M.lg = L.g0 * (1 - L.p);
          M.lp = L.p;
          M.fTx = paso2;
          cap.fN = meta;
          fL = meta * Math.pow(2, g.ssu * a / 1200) * labio * (M.aspira ? Math.pow(2, -1 / 12) : 1) * (M.flujo ? 1 - (0.15 + 0.5 * Math.exp(-cap.tS / (0.05 * fm))) * paso2 / meta : 1);
        } else if (g.stb >= 0.5) {
          const fT = 440 * Math.pow(2, (g.stn - 69 + g.stf / 100 + st) / 12);
          const k = Math.max(3, Math.round(440 * Math.pow(2, stTecla / 12) / fT));
          const fTd = fT * Math.pow(2, des / 1200);
          M.N = fm * (k + 0.19 + 0.15 / k) / (k * fTd) + 3;
          M.fTx = fTd;
          fL = k * fTd * Math.pow(2, g.ssu * a / 1200) * labio;
          cap.fN = k * fT * Math.pow(2, des / 1200);
        } else {
          M.N = 2 * fm / (fN / CAL[1]) + 3;
          fL = fN / CAL[1] * labio;
        }
        if (g.slg >= 0.5 && cap.fLv) fL = cap.fLv * Math.pow(fL / cap.fLv, 1 - Math.exp(-CADA / Math.max(1, g.slt / 1e3 * fm)));
        cap.fLv = fL;
        fL = Math.min(0.2 * fm, fL);
        const w = 2 * Math.PI * fL / fm;
        const r = 1 - Math.PI * (g.stb >= 0.5 || M.med ? (M.flujo ? 0.15 : 0.6) * M.fTx : 0.15 * fL) / fm;
        M.a1 = -2 * r * Math.cos(w);
        M.a2 = r * r;
        M.b0 = 25 * (1 - r) * 2 * Math.sin(w);
        M.tc = g.stc !== 0 && 3 * cap.fN < 0.45 * fm;
        if (M.tc) {
          const A = Math.pow(10, g.stc / 40);
          const w3 = 2 * Math.PI * 3 * cap.fN / fm;
          const al = Math.sin(w3) / (2 * 6);
          const a0 = 1 + al / A;
          M.t0 = (1 + al * A) / a0;
          M.t1 = -2 * Math.cos(w3) / a0;
          M.t2 = (1 - al * A) / a0;
          M.t4 = (1 - al / A) / a0;
        }
        M.pb = 0.4 + 0.8 * Math.min(1, a);
      } else {
        M.conico = g.sfo >= 0.5;
        if (!M.conico) {
          M.N = 0.5 * fm / (fN / CAL[2]) - 1.5;
          M.pend = -(0.26 + 0.18 * emb) * (1 + M.gri * 1.5);
        } else {
          const total = fm / (fN / CAL[3]) - 3;
          const pos = 0.2 + 0.3 * emb;
          M.N = (1 - pos) * total;
          M.N2 = pos * total;
        }
        M.pb = 0.5 + 0.4 * Math.min(1, a);
      }
      M.pb *= suave(a / 0.15);
      return M;
    };
    const CUERPO_F = [
      [280, 1100, 2700],
      [500, 1500, 3500],
      [180, 650, 2200]
    ];
    const nuevoMod = () => ({ fase: 0, ef: 0, rL: lineaS(), rR: lineaS(), bq: new Float64Array(24), co: new Float64Array(15), clave: "" });
    const coefCuerpo = (m, tipo, tam) => {
      const clave = `${tipo}|${tam}`;
      if (m.clave === clave) return;
      m.clave = clave;
      const F = CUERPO_F[Math.max(0, Math.min(2, tipo))];
      for (let k = 0; k < 3; k++) {
        const f = Math.min(0.45 * fm, F[k] / tam);
        const w = 2 * Math.PI * f / fm;
        const al = Math.sin(w) / (2 * 4);
        const a0 = 1 + al;
        m.co[5 * k] = al / a0;
        m.co[5 * k + 1] = 0;
        m.co[5 * k + 2] = -al / a0;
        m.co[5 * k + 3] = -2 * Math.cos(w) / a0;
        m.co[5 * k + 4] = (1 - al) / a0;
      }
    };
    const cuerpo = (m, x, canal) => {
      let s = 0;
      for (let k = 0; k < 3; k++) {
        const e = canal * 12 + k * 4;
        const c = 5 * k;
        const y = m.co[c] * x + m.co[c + 1] * m.bq[e] + m.co[c + 2] * m.bq[e + 1] - m.co[c + 3] * m.bq[e + 2] - m.co[c + 4] * m.bq[e + 3];
        m.bq[e + 1] = m.bq[e];
        m.bq[e] = x;
        m.bq[e + 3] = m.bq[e + 2];
        m.bq[e + 2] = y;
        s += y;
      }
      return s * 2;
    };
    const zonaDe = (nota) => {
      for (const z of zonas) if (nota >= z.baja && nota <= z.alta) return z;
      return null;
    };
    const envolvente = () => ({ fase: 0, t: 0, nivel: null, desde: 0 });
    const paso = (e, D, m) => {
      if (e.nivel === null) e.nivel = D.L[0];
      while (m > 0) {
        if (e.fase === 5) return e.nivel;
        if (e.fase === 3) return e.nivel = D.L[3];
        const T = Math.max(1, D.T[e.fase === 4 ? 3 : e.fase]);
        const a = e.fase === 4 ? e.desde : D.L[e.fase];
        const b = e.fase === 4 ? D.L[4] : D.L[e.fase + 1];
        const resta = T - e.t;
        if (m < resta) {
          e.t += m;
          e.nivel = a + (b - a) * e.t / T;
          return e.nivel;
        }
        m -= resta;
        e.nivel = b;
        e.t = 0;
        e.fase = e.fase === 4 ? 5 : e.fase + 1;
      }
      return e.nivel;
    };
    const soltar = (e) => {
      if (e.fase >= 4) return;
      e.desde = e.nivel === null ? 0 : e.nivel;
      e.fase = 4;
      e.t = 0;
    };
    function notaOn(nota, vel, p) {
      const z = zonaDe(nota);
      if (!z) return;
      const tajadas = !!z.tajadas;
      const golpe = !!z.golpe || tajadas;
      if (golpe) {
        for (const v2 of voces) if (v2.nota === nota && !v2.ahogo) v2.ahogo = AHOGO_S * fm;
      }
      if (!golpe) {
        let w = null;
        for (const v2 of voces)
          if (v2.zona === z && !v2.golpe && !v2.soltada && !v2.ahogo && v2.capas.some((c) => c.s && !c.muerta && val(p, `c${c.k}slg`, 0) >= 0.5)) {
            if (!w || v2.orden > w.orden) w = v2;
          }
        if (w) {
          w.pila = w.pila.filter((x) => x !== nota);
          w.pila.push(nota);
          w.nota = nota;
          w.tecX = Math.max(-2.5, Math.min(2.5, (nota - 60) / 24));
          return;
        }
      }
      const capas = [];
      (z.capas || []).slice(0, 3).forEach((c, k) => {
        const pc = prepararCapa(c, tajadas ? nota - z.baja : -1, nota);
        if (!pc) return;
        capas.push({
          c: pc,
          k: k + 1,
          pos: pc.osc ? 0 : pc.ini,
          pos2: pc.osc ? 0 : pc.ini,
          viva: true,
          viva2: true,
          muerta: false,
          espera: Math.round(Math.max(0, val(p, `c${k + 1}ret`, 0)) / 1e3 * fm),
          eV: envolvente(),
          eF: envolvente(),
          eP: envolvente(),
          f: [0, 0, 0, 0],
          fG: 0,
          fK: 1,
          cuenta: 0,
          r: [0, 0, 0],
          s: pc.mod ? nuevoSoplo() : null,
          m: null,
          cola: 0,
          lv: 0,
          dlv: 0,
          fin: false
        });
      });
      if (!capas.length) return;
      if (voces.length >= VOCES) {
        let vieja = voces[0];
        for (const v2 of voces) if (v2.orden < vieja.orden) vieja = v2;
        vieja.ahogo = vieja.ahogo || AHOGO_S * fm;
        if (voces.length >= VOCES + 8) voces.splice(voces.indexOf(vieja), 1);
      }
      const ve = Math.max(0, Math.min(127, vel));
      voces.push({
        nota,
        raiz: tajadas ? nota : Number(z.raiz) || 60,
        golpe,
        capas,
        vel: ve,
        velX: (ve - 64) / 63,
        tecX: Math.max(-2.5, Math.min(2.5, (nota - 60) / 24)),
        soltada: false,
        soltadaHecha: false,
        zona: z,
        pila: [nota],
        ahogo: 0,
        ahogoN: 1,
        orden: orden++,
        subFase: 0
      });
    }
    function notaOff(nota) {
      for (const v2 of voces) {
        if (v2.golpe || v2.soltada || !v2.pila.includes(nota)) continue;
        v2.pila = v2.pila.filter((x) => x !== nota);
        if (v2.pila.length) {
          if (v2.nota === nota) {
            v2.nota = v2.pila[v2.pila.length - 1];
            v2.tecX = Math.max(-2.5, Math.min(2.5, (v2.nota - 60) / 24));
          }
        } else v2.soltada = true;
      }
    }
    function callar() {
      for (const v2 of voces) v2.ahogo = v2.ahogo || AHOGO_S * fm;
    }
    const blep = (t2, dt) => {
      if (t2 < dt) {
        const x = t2 / dt;
        return x + x - x * x - 1;
      }
      if (t2 > 1 - dt) {
        const x = (t2 - 1) / dt;
        return x * x + x + x + 1;
      }
      return 0;
    };
    const onda = (c, t2, dt) => {
      if (c.forma === 0) return Math.sin(2 * Math.PI * t2);
      if (c.forma === 1) return 1 - 4 * Math.abs(t2 - 0.5);
      if (c.forma === 2) return 2 * t2 - 1 - blep(t2, dt);
      const w = c.ancho;
      let t22 = t2 + 1 - w;
      if (t22 >= 1) t22 -= 1;
      return (t2 < w ? 1 : -1) + blep(t2, dt) - blep(t22, dt);
    };
    const forma = (k, ph, l) => {
      if (k === 0) return Math.sin(2 * Math.PI * ph);
      if (k === 1) return 1 - 4 * Math.abs(ph - 0.5);
      if (k === 2) return ph < 0.5 ? 1 : -1;
      if (k === 3) return 2 * ph - 1;
      return l.azar;
    };
    const CLAVES = ["smt", "sex", "sfo", "stb", "stn", "sgm", "slm", "slc", "sdc", "slh", "sdh", "sfh", "spa", "scb", "sen", "svu", "ssn", "slb", "sbq", "sbv", "sbg", "sbr", "stf", "sai", "sem", "sru", "ssu", "sds", "sdt", "sdx", "slg", "slt", "sgl", "srs", "svn", "sin", "siv", "ssa", "sas", "sgr", "sgi", "sap", "sca", "sbo", "sf1", "sf2", "stc", "sdf", "sde", "sfa", "mhm", "mhi", "mhz", "mrm", "mrf", "mrz", "mcm", "mct", "mcy", "niv", "afi", "vat", "val", "vdt", "vbp", "vst", "vsl", "vrt", "vvs", "vvt", "vkt", "ft", "fc", "fr", "fi", "fl0", "fat", "fal", "fdt", "fbp", "fst", "fsl", "frt", "frl", "fvi", "fvt", "fkc", "fkt", "pi", "pl0", "pat", "pal", "pdt", "prt", "prl", "pvi", "pvt"];
    for (const pre of ["vvp", "vkp", "fvp", "fkp"]) for (const L of "ADSR") CLAVES.push(pre + L);
    const DEFECTO = {};
    for (const q of PARAMS) if (q.id.startsWith("c1")) DEFECTO[q.id.slice(2)] = q.defecto;
    const IDS = [1, 2, 3].map((k) => CLAVES.map((c) => [c, `c${k}${c}`]));
    const leerCapa = (p, k) => {
      const o = {};
      for (const [c, id] of IDS[k - 1]) o[c] = p[id] === void 0 ? DEFECTO[c] : p[id];
      o.firma = firmaDe(o);
      o.ganBase = dB(o.niv);
      o.ftipo = Math.round(o.ft);
      o.fK = 1 / (0.5 * Math.pow(40, Math.max(0, Math.min(100, o.fr)) / 100));
      return o;
    };
    const ms = (x) => Math.max(1, x / 1e3 * fm);
    const firmaDe = (g) => {
      let f = g.vvt + g.vkt * 101 + g.fvt * 10201 + g.fkt * 1030301 + g.pvt * 104060401;
      let b = 1;
      for (const pre of ["vvp", "vkp", "fvp", "fkp"]) for (const L of "ADSR") {
        f += Math.round(g[pre + L]) * b * 1e-6;
        b *= 3;
      }
      return f;
    };
    const describir = (v2, cap, g, g3) => {
      let d = cap.d;
      if (!d) {
        d = cap.d = {
          vol: { T: [1, 1, 1, 1], L: [0, 0, 0, 0, 0] },
          fil: { T: [1, 1, 1, 1], L: [0, 0, 0, 0, 0], int: 0 },
          alt: { T: [1, 1, 1, 1], L: [0, 0, 0, 0, 0], int: 0 },
          tv: [1, 1, 1, 1],
          tf: [1, 1, 1, 1],
          pt: 1,
          firma: NaN
        };
      }
      if (d.firma !== g.firma) {
        d.firma = g.firma;
        for (let w = 0; w < 4; w++) {
          const L = "ADSR"[w];
          d.tv[w] = porTiempo(g["vvp" + L], g.vvt / 100, v2.velX) * porTiempo(g["vkp" + L], g.vkt / 100, v2.tecX);
          d.tf[w] = porTiempo(g["fvp" + L], g.fvt / 100, v2.velX) * porTiempo(g["fkp" + L], g.fkt / 100, v2.tecX);
        }
        d.pt = Math.pow(2, g.pvt / 100 * v2.velX * 3);
      }
      const [fa, fd, fr] = g3;
      const V = d.vol;
      V.T[0] = ms(g.vat) * fa * d.tv[0];
      V.T[1] = ms(g.vdt) * fd * d.tv[1];
      V.T[2] = ms(g.vst) * fd * d.tv[2];
      V.T[3] = ms(g.vrt) * fr * d.tv[3];
      V.L[1] = g.val / 100;
      V.L[2] = g.vbp / 100;
      V.L[3] = v2.golpe && (cap.c.osc || cap.c.mod) ? 0 : g.vsl / 100;
      d.g = g;
      const F = d.fil;
      F.T[0] = ms(g.fat) * fa * d.tf[0];
      F.T[1] = ms(g.fdt) * fd * d.tf[1];
      F.T[2] = ms(g.fst) * fd * d.tf[2];
      F.T[3] = ms(g.frt) * fr * d.tf[3];
      F.L[0] = g.fl0 / 100;
      F.L[1] = g.fal / 100;
      F.L[2] = g.fbp / 100;
      F.L[3] = g.fsl / 100;
      F.L[4] = g.frl / 100;
      F.int = g.fi * (1 + g.fvi / 100 * v2.velX);
      const A = d.alt;
      A.T[0] = ms(g.pat) * fa * d.pt;
      A.T[1] = ms(g.pdt) * fd * d.pt;
      A.T[2] = 1;
      A.T[3] = ms(g.prt) * fr * d.pt;
      A.L[0] = g.pl0 / 100;
      A.L[1] = g.pal / 100;
      A.L[4] = g.prl / 100;
      A.int = g.pi * (1 + g.pvi / 100 * v2.velX);
      const sens = Math.max(0, Math.min(1, g.vvs / 100));
      d.gan = g.ganBase * (1 - sens + sens * v2.vel / 127);
      d.afi = g.afi;
      d.ftipo = g.ftipo;
      d.corte = g.fkc ? g.fc * Math.pow(2, g.fkc / 100 * (v2.nota - 60) / 12) : g.fc;
      d.fK = g.fK;
      return d;
    };
    function procesar(sL, sR, desde, hasta, p) {
      const n = hasta - desde;
      if (n <= 0) return;
      if (mVol.length < n) {
        mVol = new Float32Array(n);
        mFil = new Float32Array(n);
        mDis = new Float32Array(n);
        mPan = new Float32Array(n);
      }
      const vol = dB(val(p, "vol", 0));
      const afinar = val(p, "afinar", 0);
      const g3 = [Math.pow(2, val(p, "gat", 0) / 12.5), Math.pow(2, val(p, "gdt", 0) / 12.5), Math.pow(2, val(p, "grt", 0) / 12.5)];
      const ruido = Math.pow(Math.max(0, val(p, "ruido", 0)) / 100, 2) * 0.5;
      const desaf = Math.max(0, val(p, "desaf", 0));
      const sub = Math.max(0, val(p, "sub", 0)) / 100 * 0.6;
      const subOct = Math.round(val(p, "subOct", 0)) === 1 ? 2 : 1;
      const subCuadrada = Math.round(val(p, "subForma", 0)) === 1;
      let altSt = 0;
      mVol.fill(1, 0, n);
      mFil.fill(0, 0, n);
      mDis.fill(0, 0, n);
      mPan.fill(0, 0, n);
      let hayPan = false;
      for (let k = 0; k < 2; k++) {
        const pre = `l${k + 1}`;
        const prof = Math.max(0, Math.min(100, val(p, `${pre}p`, 0))) / 100;
        const l = lfo[k];
        const ritmo = Math.max(0, val(p, `${pre}v`, 2)) / fm;
        if (prof <= 0) {
          l.fase = (l.fase + ritmo * n) % 1;
          continue;
        }
        const fo = Math.round(val(p, `${pre}f`, 0));
        const de = Math.round(val(p, `${pre}d`, 0));
        if (de === 0) altSt += forma(fo, l.fase, l) * 12 * prof * prof;
        if (de === 4) hayPan = true;
        for (let i = 0; i < n; i++) {
          const x = forma(fo, l.fase, l);
          if (de === 1) mVol[i] *= 1 - prof * (1 - x) / 2;
          else if (de === 2) mFil[i] += x * prof * 4;
          else if (de === 3) mDis[i] += x * prof * 24;
          else if (de === 4) mPan[i] += x * prof;
          l.fase += ritmo;
          if (l.fase >= 1) {
            l.fase -= 1;
            l.azar = azar();
          }
        }
      }
      const S = [null, leerCapa(p, 1), leerCapa(p, 2), leerCapa(p, 3)];
      const dA = Math.pow(2, -desaf / 2400);
      const dB2 = Math.pow(2, desaf / 2400);
      for (let kv = voces.length - 1; kv >= 0; kv--) {
        const v2 = voces[kv];
        if (v2.soltada && !v2.golpe && !v2.soltadaHecha) {
          v2.soltadaHecha = true;
          for (const cap of v2.capas) {
            soltar(cap.eV);
            soltar(cap.eF);
            soltar(cap.eP);
          }
        }
        const ds = v2.capas.map((cap) => describir(v2, cap, S[cap.k], g3));
        const subPaso = 440 * Math.pow(2, (v2.nota - 69 - 12 * subOct + afinar + altSt) / 12) / fm;
        const primera = v2.capas.findIndex((x) => !x.muerta);
        let terminada = false;
        for (let j = 0; j < n; j++) {
          const i = desde + j;
          let ah = 1;
          if (v2.ahogo) {
            v2.ahogoN -= 1 / Math.max(1, v2.ahogo);
            if (v2.ahogoN <= 0) {
              terminada = true;
              break;
            }
            ah = v2.ahogoN;
          }
          let oL = 0;
          let oR = 0;
          let vivas = 0;
          for (let q = 0; q < v2.capas.length; q++) {
            const cap = v2.capas[q];
            if (cap.muerta) continue;
            vivas++;
            if (cap.espera > 0) {
              cap.espera--;
              continue;
            }
            const d = ds[q];
            const c = cap.c;
            if (cap.cuenta-- <= 0) {
              cap.cuenta = CADA - 1;
              const meta = paso(cap.eV, d.vol, CADA);
              cap.dlv = (meta - cap.lv) / CADA;
              const lf = paso(cap.eF, d.fil, CADA);
              const lp = paso(cap.eP, d.alt, CADA);
              if (c.mod) {
                if (cap.eV.fase === 5 || cap.eV.fase === 3 && d.vol.L[3] <= 0) {
                  cap.cola += CADA;
                  if (cap.cola > 0.25 * fm) cap.muerta = true;
                } else cap.cola = 0;
              } else if (cap.eV.fase === 5 || cap.eV.fase === 3 && d.vol.L[3] <= 0) cap.fin = true;
              else if (cap.fin) cap.fin = false;
              const st = afinar + altSt + d.afi + d.alt.int * lp;
              if (c.mod) prepararSoplo(cap, d.g, v2, st, meta);
              else if (c.osc) {
                const f = 440 * Math.pow(2, (v2.nota - 69 + c.afinar + st) / 12) / fm;
                cap.r[0] = cap.r[1] = cap.r[2] = f;
                cap.fN = f * fm;
              } else {
                const base = c.mu.fm / fm;
                const conNota = Math.pow(2, (v2.nota - v2.raiz + c.afinar + st) / 12);
                const sinNota = Math.pow(2, (c.afinar + st) / 12);
                for (let w = 0; w < 3; w++) cap.r[w] = base * (c.alt[w] ? conNota : sinNota);
                cap.fN = 440 * Math.pow(2, (v2.nota - 69 + c.afinar + st) / 12);
              }
              if (d.ftipo > 0) {
                const f = Math.min(0.45 * fm, Math.max(20, d.corte * Math.pow(2, d.fil.int * lf + mFil[j])));
                cap.fG = Math.tan(Math.PI * f / fm);
                cap.fK = d.fK;
              }
            }
            let xL = 0;
            let xR = 0;
            if (c.mod) {
              const y = soplar(cap.s, cap.M, (cap.lv + cap.dlv) * cap.M.pb);
              xL = y * c.gL;
              xR = y * c.gR;
            } else if (c.osc) {
              const pa = cap.r[0] * dA;
              const pb = cap.r[0] * dB2;
              xL = onda(c, cap.pos, pa) * c.gL;
              xR = onda(c, cap.pos2, pb) * c.gR;
              cap.pos += pa;
              if (cap.pos >= 1) cap.pos -= 1;
              cap.pos2 += pb;
              if (cap.pos2 >= 1) cap.pos2 -= 1;
            } else {
              const enLoop = c.loop && !v2.golpe && !v2.soltada;
              const L = c.mu.c[0];
              const R = c.mu.c[1] || L;
              if (cap.viva) {
                xL = cabeza(c, L, cap.pos, enLoop) * c.gL;
                cap.pos += cap.r[parteDe(c, cap.pos)] * dA;
                if (enLoop && cap.pos >= c.lFin) cap.pos -= c.lFin - c.lIni;
                if (cap.pos >= c.fin) cap.viva = false;
              }
              if (cap.viva2) {
                xR = cabeza(c, R, cap.pos2, enLoop) * c.gR;
                cap.pos2 += cap.r[parteDe(c, cap.pos2)] * dB2;
                if (enLoop && cap.pos2 >= c.lFin) cap.pos2 -= c.lFin - c.lIni;
                if (cap.pos2 >= c.fin) cap.viva2 = false;
              }
              if (!cap.viva && !cap.viva2) cap.muerta = true;
            }
            if (q === primera) {
              if (ruido > 0) {
                const r = azar() * ruido;
                xL += r;
                xR += r;
              }
              if (sub > 0) {
                const s = (subCuadrada ? v2.subFase < 0.5 ? 0.7 : -0.7 : Math.sin(2 * Math.PI * v2.subFase)) * sub;
                xL += s;
                xR += s;
                v2.subFase += subPaso;
                if (v2.subFase >= 1) v2.subFase -= 1;
              }
            }
            const g = d.g;
            if (g.mhm > 0 || g.mrm > 0 || g.mcm > 0) {
              const m = cap.m || (cap.m = nuevoMod());
              const fN = cap.fN || 440;
              if (g.mhm > 0) {
                const x = 0.5 * (xL + xR);
                m.ef = 0.995 * m.ef + 5e-3 * Math.abs(x);
                m.fase += fN * g.mhz / fm;
                if (m.fase >= 1) m.fase -= Math.floor(m.fase);
                const y = Math.sin(2 * Math.PI * m.fase + g.mhi / 100 * 4 * x) * m.ef * 2;
                const k = g.mhm / 100;
                xL = xL * (1 - k) + y * k;
                xR = xR * (1 - k) + y * k;
              }
              if (g.mrm > 0) {
                const dl = fm / Math.max(20, fN * g.mrz);
                const fb = g.mrf / 100;
                const yL = xL + fb * leerS(m.rL, dl);
                const yR = xR + fb * leerS(m.rR, dl);
                ponerS(m.rL, yL);
                ponerS(m.rR, yR);
                const k = g.mrm / 100;
                xL = xL * (1 - k) + yL * k * (1 - fb);
                xR = xR * (1 - k) + yR * k * (1 - fb);
              }
              if (g.mcm > 0) {
                coefCuerpo(m, Math.round(g.mcy), g.mct);
                const k = g.mcm / 100;
                xL = xL * (1 - k) + cuerpo(m, xL, 0) * k;
                xR = xR * (1 - k) + cuerpo(m, xR, 1) * k;
              }
            }
            if (d.ftipo > 0) {
              const gg = cap.fG;
              const kk = cap.fK;
              const a1 = 1 / (1 + gg * (gg + kk));
              const a2 = gg * a1;
              const a3 = gg * a2;
              const s = cap.f;
              for (let o = 0; o < 2; o++) {
                const x = o === 0 ? xL : xR;
                const v3 = x - s[2 * o + 1];
                const v1 = a1 * s[2 * o] + a2 * v3;
                const v22 = s[2 * o + 1] + a2 * s[2 * o] + a3 * v3;
                s[2 * o] = 2 * v1 - s[2 * o];
                s[2 * o + 1] = 2 * v22 - s[2 * o + 1];
                const y = d.ftipo === 1 ? v22 : d.ftipo === 2 ? x - kk * v1 - v22 : v1;
                if (o === 0) xL = y;
                else xR = y;
              }
            }
            cap.lv += cap.dlv;
            const gc = c.mod ? d.gan : cap.lv * d.gan;
            oL += xL * gc;
            oR += xR * gc;
            if (cap.fin && cap.cuenta === 0) cap.muerta = true;
          }
          if (!vivas) {
            terminada = true;
            break;
          }
          let gL = vol * mVol[j] * ah;
          let gR = gL;
          if (hayPan) {
            const a = (Math.max(-1, Math.min(1, mPan[j])) + 1) * Math.PI / 4;
            gL *= Math.cos(a) * Math.SQRT2;
            gR *= Math.sin(a) * Math.SQRT2;
          }
          sL[i] += oL * gL;
          sR[i] += oR * gR;
        }
        if (terminada || v2.capas.every((x) => x.muerta)) voces.splice(kv, 1);
      }
      const dist = val(p, "dist", 0);
      const mez = Math.max(0, Math.min(100, val(p, "dmez", 100))) / 100;
      if (mez > 0 && (dist > 0 || mDis.some((x, j) => j < n && x !== 0))) {
        for (let j = 0; j < n; j++) {
          const dd = dist + mDis[j];
          if (dd <= 0) continue;
          const g = dB(dd);
          const comp = 1 / Math.sqrt(g);
          const i = desde + j;
          sL[i] = sL[i] * (1 - mez) + Math.tanh(g * sL[i]) * comp * mez;
          sR[i] = sR[i] * (1 - mez) + Math.tanh(g * sR[i]) * comp * mez;
        }
      }
    }
    return {
      ponerMuestra(m, canales, fmMuestra) {
        muestras.set(m, { c: canales, fm: fmMuestra || fm });
      },
      quitarMuestra(m) {
        muestras.delete(m);
      },
      ponerInstrumento(def) {
        zonas = Array.isArray(def && def.zonas) ? def.zonas.filter((z) => z && Array.isArray(z.capas)) : [];
      },
      notaOn,
      notaOff,
      callar,
      // Un control en vivo para el aire: 'rueda', 'aliento', 'expresion' o 'presion', de 0 a 1.
      controlar(nombre, valor) {
        vivo[nombre] = Math.max(0, Math.min(1, Number(valor) || 0));
      },
      procesar,
      cuantasVoces: () => voces.length
    };
  }
  return { PARAMS, TIPOS_FILTRO, FORMAS, DESTINOS, POLARIDAD, MODELOS, crear, medidaTubo };
}

// sampler/procesador.js
function procesadorSampler(moduleId, nucleo) {
  const ambito = globalThis.webAudioModules.getModuleScope(moduleId);
  const { WamProcessor, WamParameterInfo } = ambito;
  const N2 = nucleo();
  const ids = N2.PARAMS.map((p) => p.id);
  class ProcesadorSampler extends WamProcessor {
    constructor(options) {
      super(options);
      this._s = N2.crear(sampleRate);
      this._p = {};
      for (const p of N2.PARAMS) this._p[p.id] = p.defecto;
      this._tmpR = new Float32Array(128);
    }
    _generateWamParameterInfo() {
      const info = {};
      for (const p of N2.PARAMS) {
        info[p.id] = new WamParameterInfo(p.id, {
          type: p.tipo || "float",
          label: p.nombre,
          defaultValue: p.defecto,
          minValue: p.min,
          maxValue: p.max,
          units: p.unidad || "",
          choices: p.opciones
        });
      }
      return info;
    }
    async _onMessage(message) {
      const d = message.data;
      if (d && d.pz) {
        if (d.pz === "muestra") this._s.ponerMuestra(d.m, d.canales, d.fm);
        else if (d.pz === "quitar") this._s.quitarMuestra(d.m);
        else if (d.pz === "inst") this._s.ponerInstrumento(d.inst);
        else if (d.pz === "callar") this._s.callar();
        return;
      }
      return super._onMessage(message);
    }
    // El tempo del anfitrión (`wam-transport`): se le pasa al nodo, que es el que estira.
    _onTransport(datos) {
      const bpm = datos && Number(datos.tempo);
      if (bpm > 0 && bpm !== this._bpm) {
        this._bpm = bpm;
        this.port.postMessage({ pz: "tempo", bpm });
      }
    }
    _onMidi(midi) {
      const b = midi && midi.bytes;
      if (!b) return;
      const tipo = b[0] & 240;
      if (tipo === 144 && b[2] > 0) this._s.notaOn(b[1], b[2], this._p);
      else if (tipo === 128 || tipo === 144 && b[2] === 0) this._s.notaOff(b[1]);
      else if (tipo === 176 && (b[1] === 120 || b[1] === 123)) this._s.callar();
      else if (tipo === 176 && b[1] === 1) this._s.controlar("rueda", b[2] / 127);
      else if (tipo === 176 && b[1] === 2) this._s.controlar("aliento", b[2] / 127);
      else if (tipo === 176 && b[1] === 11) this._s.controlar("expresion", b[2] / 127);
      else if (tipo === 208) this._s.controlar("presion", b[1] / 127);
      else if (tipo === 160) this._s.controlar("presion", b[2] / 127);
    }
    _process(desde, hasta, inputs, outputs) {
      const sal = outputs[0];
      if (!sal || !sal.length) return;
      const I = this._parameterInterpolators;
      for (let k = 0; k < ids.length; k++) this._p[ids[k]] = I[ids[k]].values[desde];
      const L = sal[0];
      const R = sal[1] || this._tmpR;
      if (!sal[1]) this._tmpR.fill(0);
      this._s.procesar(L, R, desde, hasta, this._p);
      if (!sal[1]) for (let i = desde; i < hasta; i++) L[i] = 0.5 * (L[i] + R[i]);
    }
  }
  try {
    registerProcessor(moduleId, ProcesadorSampler);
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
  // --- los presets del sampler (2026-11-26)
  Preset: ["Preset", "Predefini\xE7\xE3o", "Pr\xE9r\xE9glage", "Aurrezarpena", "\u041F\u0440\u0435\u0441\u0435\u0442", "\u30D7\u30EA\u30BB\u30C3\u30C8", "\uD504\uB9AC\uC14B", "\u9884\u8BBE", "\u0E1E\u0E23\u0E35\u0E40\u0E0B\u0E47\u0E15"],
  "Nombre del preset": ["Preset name", "Nome da predefini\xE7\xE3o", "Nom du pr\xE9r\xE9glage", "Aurrezarpenaren izena", "\u0418\u043C\u044F \u043F\u0440\u0435\u0441\u0435\u0442\u0430", "\u30D7\u30EA\u30BB\u30C3\u30C8\u540D", "\uD504\uB9AC\uC14B \uC774\uB984", "\u9884\u8BBE\u540D\u79F0", "\u0E0A\u0E37\u0E48\u0E2D\u0E1E\u0E23\u0E35\u0E40\u0E0B\u0E47\u0E15"],
  "De f\xE1brica": ["Factory", "De f\xE1brica", "D\u2019usine", "Fabrikakoak", "\u0417\u0430\u0432\u043E\u0434\u0441\u043A\u0438\u0435", "\u30D5\u30A1\u30AF\u30C8\u30EA\u30FC", "\uAE30\uBCF8 \uC81C\uACF5", "\u51FA\u5382", "\u0E08\u0E32\u0E01\u0E42\u0E23\u0E07\u0E07\u0E32\u0E19"],
  Guardar: ["Save", "Salvar", "Enregistrer", "Gorde", "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C", "\u4FDD\u5B58", "\uC800\uC7A5", "\u4FDD\u5B58", "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01"],
  Borrar: ["Delete", "Apagar", "Supprimer", "Ezabatu", "\u0423\u0434\u0430\u043B\u0438\u0442\u044C", "\u524A\u9664", "\uC0AD\uC81C", "\u5220\u9664", "\u0E25\u0E1A"],
  "Bajar archivo": ["Download file", "Baixar arquivo", "T\xE9l\xE9charger le fichier", "Deskargatu fitxategia", "\u0421\u043A\u0430\u0447\u0430\u0442\u044C \u0444\u0430\u0439\u043B", "\u30D5\u30A1\u30A4\u30EB\u3092\u30C0\u30A6\u30F3\u30ED\u30FC\u30C9", "\uD30C\uC77C \uB0B4\uB824\uBC1B\uAE30", "\u4E0B\u8F7D\u6587\u4EF6", "\u0E14\u0E32\u0E27\u0E19\u0E4C\u0E42\u0E2B\u0E25\u0E14\u0E44\u0E1F\u0E25\u0E4C"],
  "Subir archivo": ["Upload file", "Enviar arquivo", "Importer un fichier", "Igo fitxategia", "\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0444\u0430\u0439\u043B", "\u30D5\u30A1\u30A4\u30EB\u3092\u8AAD\u307F\u8FBC\u3080", "\uD30C\uC77C \uC62C\uB9AC\uAE30", "\u4E0A\u4F20\u6587\u4EF6", "\u0E2D\u0E31\u0E1B\u0E42\u0E2B\u0E25\u0E14\u0E44\u0E1F\u0E25\u0E4C"],
  "En la caja": ["In the drum machine", "Na caixa de ritmos", "Dans la bo\xEEte \xE0 rythmes", "Kutxan", "\u0412 \u0434\u0440\u0430\u043C-\u043C\u0430\u0448\u0438\u043D\u0435", "\u30EA\u30BA\u30E0\u30DC\u30C3\u30AF\u30B9\u5185", "\uB4DC\uB7FC \uBA38\uC2E0\uC5D0", "\u5728\u9F13\u673A\u91CC", "\u0E43\u0E19\u0E01\u0E25\u0E48\u0E2D\u0E07\u0E08\u0E31\u0E07\u0E2B\u0E27\u0E30"],
  "En este navegador": ["In this browser", "Neste navegador", "Dans ce navigateur", "Nabigatzaile honetan", "\u0412 \u044D\u0442\u043E\u043C \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0435", "\u3053\u306E\u30D6\u30E9\u30A6\u30B6", "\uC774 \uBE0C\uB77C\uC6B0\uC800\uC5D0", "\u5728\u6B64\u6D4F\u89C8\u5668", "\u0E43\u0E19\u0E40\u0E1A\u0E23\u0E32\u0E27\u0E4C\u0E40\u0E0B\u0E2D\u0E23\u0E4C\u0E19\u0E35\u0E49"],
  "Guardar en la caja": ["Save in the drum machine", "Salvar na caixa", "Enregistrer dans la bo\xEEte", "Gorde kutxan", "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0432 \u0434\u0440\u0430\u043C-\u043C\u0430\u0448\u0438\u043D\u0435", "\u30EA\u30BA\u30E0\u30DC\u30C3\u30AF\u30B9\u306B\u4FDD\u5B58", "\uB4DC\uB7FC \uBA38\uC2E0\uC5D0 \uC800\uC7A5", "\u5B58\u5230\u9F13\u673A", "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E43\u0E19\u0E01\u0E25\u0E48\u0E2D\u0E07\u0E08\u0E31\u0E07\u0E2B\u0E27\u0E30"],
  "Guardado en la caja": ["Saved in the drum machine", "Salvo na caixa", "Enregistr\xE9 dans la bo\xEEte", "Kutxan gordeta", "\u0421\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u043E \u0432 \u0434\u0440\u0430\u043C-\u043C\u0430\u0448\u0438\u043D\u0435", "\u30EA\u30BA\u30E0\u30DC\u30C3\u30AF\u30B9\u306B\u4FDD\u5B58\u3057\u307E\u3057\u305F", "\uB4DC\uB7FC \uBA38\uC2E0\uC5D0 \uC800\uC7A5\uB428", "\u5DF2\u5B58\u5230\u9F13\u673A", "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E43\u0E19\u0E01\u0E25\u0E48\u0E2D\u0E07\u0E08\u0E31\u0E07\u0E2B\u0E27\u0E30\u0E41\u0E25\u0E49\u0E27"],
  "No se pudo guardar en la caja": ["Could not save in the drum machine", "N\xE3o foi poss\xEDvel salvar na caixa", "Impossible d\u2019enregistrer dans la bo\xEEte", "Ezin izan da kutxan gorde", "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0432 \u0434\u0440\u0430\u043C-\u043C\u0430\u0448\u0438\u043D\u0435", "\u30EA\u30BA\u30E0\u30DC\u30C3\u30AF\u30B9\u306B\u4FDD\u5B58\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F", "\uB4DC\uB7FC \uBA38\uC2E0\uC5D0 \uC800\uC7A5\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4", "\u65E0\u6CD5\u5B58\u5230\u9F13\u673A", "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E43\u0E19\u0E01\u0E25\u0E48\u0E2D\u0E07\u0E08\u0E31\u0E07\u0E2B\u0E27\u0E30\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49"],
  "Guardado en este navegador": ["Saved in this browser", "Salvo neste navegador", "Enregistr\xE9 dans ce navigateur", "Nabigatzaile honetan gordeta", "\u0421\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u043E \u0432 \u044D\u0442\u043E\u043C \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0435", "\u3053\u306E\u30D6\u30E9\u30A6\u30B6\u306B\u4FDD\u5B58\u3057\u307E\u3057\u305F", "\uC774 \uBE0C\uB77C\uC6B0\uC800\uC5D0 \uC800\uC7A5\uB428", "\u5DF2\u4FDD\u5B58\u5728\u6B64\u6D4F\u89C8\u5668", "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E43\u0E19\u0E40\u0E1A\u0E23\u0E32\u0E27\u0E4C\u0E40\u0E0B\u0E2D\u0E23\u0E4C\u0E19\u0E35\u0E49\u0E41\u0E25\u0E49\u0E27"],
  "Este navegador no deja guardar": ["This browser does not allow saving", "Este navegador n\xE3o permite salvar", "Ce navigateur ne permet pas d\u2019enregistrer", "Nabigatzaile honek ez du gordetzen uzten", "\u042D\u0442\u043E\u0442 \u0431\u0440\u0430\u0443\u0437\u0435\u0440 \u043D\u0435 \u043F\u043E\u0437\u0432\u043E\u043B\u044F\u0435\u0442 \u0441\u043E\u0445\u0440\u0430\u043D\u044F\u0442\u044C", "\u3053\u306E\u30D6\u30E9\u30A6\u30B6\u3067\u306F\u4FDD\u5B58\u3067\u304D\u307E\u305B\u3093", "\uC774 \uBE0C\uB77C\uC6B0\uC800\uC5D0\uC11C\uB294 \uC800\uC7A5\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4", "\u6B64\u6D4F\u89C8\u5668\u4E0D\u5141\u8BB8\u4FDD\u5B58", "\u0E40\u0E1A\u0E23\u0E32\u0E27\u0E4C\u0E40\u0E0B\u0E2D\u0E23\u0E4C\u0E19\u0E35\u0E49\u0E44\u0E21\u0E48\u0E2D\u0E19\u0E38\u0E0D\u0E32\u0E15\u0E43\u0E2B\u0E49\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01"],
  "Falta el nombre del preset": ["The preset needs a name", "Falta o nome da predefini\xE7\xE3o", "Il manque le nom du pr\xE9r\xE9glage", "Aurrezarpenaren izena falta da", "\u041D\u0443\u0436\u043D\u043E \u0438\u043C\u044F \u043F\u0440\u0435\u0441\u0435\u0442\u0430", "\u30D7\u30EA\u30BB\u30C3\u30C8\u540D\u304C\u3042\u308A\u307E\u305B\u3093", "\uD504\uB9AC\uC14B \uC774\uB984\uC774 \uC5C6\uC2B5\uB2C8\uB2E4", "\u7F3A\u5C11\u9884\u8BBE\u540D\u79F0", "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E0A\u0E37\u0E48\u0E2D\u0E1E\u0E23\u0E35\u0E40\u0E0B\u0E47\u0E15"],
  "Ese archivo no es un preset del sampler": ["That file is not a sampler preset", "Esse arquivo n\xE3o \xE9 uma predefini\xE7\xE3o do sampler", "Ce fichier n\u2019est pas un pr\xE9r\xE9glage du sampler", "Fitxategi hori ez da samplerraren aurrezarpen bat", "\u042D\u0442\u043E\u0442 \u0444\u0430\u0439\u043B \u043D\u0435 \u043F\u0440\u0435\u0441\u0435\u0442 \u0441\u044D\u043C\u043F\u043B\u0435\u0440\u0430", "\u305D\u306E\u30D5\u30A1\u30A4\u30EB\u306F\u30B5\u30F3\u30D7\u30E9\u30FC\u306E\u30D7\u30EA\u30BB\u30C3\u30C8\u3067\u306F\u3042\u308A\u307E\u305B\u3093", "\uADF8 \uD30C\uC77C\uC740 \uC0D8\uD50C\uB7EC \uD504\uB9AC\uC14B\uC774 \uC544\uB2D9\uB2C8\uB2E4", "\u8BE5\u6587\u4EF6\u4E0D\u662F\u91C7\u6837\u5668\u9884\u8BBE", "\u0E44\u0E1F\u0E25\u0E4C\u0E19\u0E31\u0E49\u0E19\u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48\u0E1E\u0E23\u0E35\u0E40\u0E0B\u0E47\u0E15\u0E02\u0E2D\u0E07\u0E41\u0E0B\u0E21\u0E40\u0E1E\u0E25\u0E2D\u0E23\u0E4C"],
  "Los audios abiertos desde el computador no quedan en el preset": ["Audio opened from the computer is not kept in the preset", "Os \xE1udios abertos do computador n\xE3o ficam na predefini\xE7\xE3o", "Les sons ouverts depuis l\u2019ordinateur ne restent pas dans le pr\xE9r\xE9glage", "Ordenagailutik irekitako audioak ez dira aurrezarpenean gelditzen", "\u0410\u0443\u0434\u0438\u043E, \u043E\u0442\u043A\u0440\u044B\u0442\u043E\u0435 \u0441 \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440\u0430, \u043D\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u044F\u0435\u0442\u0441\u044F \u0432 \u043F\u0440\u0435\u0441\u0435\u0442\u0435", "\u30B3\u30F3\u30D4\u30E5\u30FC\u30BF\u30FC\u304B\u3089\u958B\u3044\u305F\u97F3\u58F0\u306F\u30D7\u30EA\u30BB\u30C3\u30C8\u306B\u6B8B\u308A\u307E\u305B\u3093", "\uCEF4\uD4E8\uD130\uC5D0\uC11C \uC5F0 \uC624\uB514\uC624\uB294 \uD504\uB9AC\uC14B\uC5D0 \uB0A8\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4", "\u4ECE\u7535\u8111\u6253\u5F00\u7684\u97F3\u9891\u4E0D\u4F1A\u4FDD\u5B58\u5728\u9884\u8BBE\u4E2D", "\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E17\u0E35\u0E48\u0E40\u0E1B\u0E34\u0E14\u0E08\u0E32\u0E01\u0E04\u0E2D\u0E21\u0E1E\u0E34\u0E27\u0E40\u0E15\u0E2D\u0E23\u0E4C\u0E08\u0E30\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E40\u0E01\u0E47\u0E1A\u0E43\u0E19\u0E1E\u0E23\u0E35\u0E40\u0E0B\u0E47\u0E15"],
  "Trutruka (ca\xF1er\xEDa de agua y cacho de vaca)": ["Trutruka (water pipe and cow horn)", "Trutruka (cano de \xE1gua e chifre de vaca)", "Trutruka (tuyau d\u2019eau et corne de vache)", "Trutruka (ur-hodia eta behi-adarra)", "\u0422\u0440\u0443\u0442\u0440\u0443\u043A\u0430 (\u0432\u043E\u0434\u043E\u043F\u0440\u043E\u0432\u043E\u0434\u043D\u0430\u044F \u0442\u0440\u0443\u0431\u0430 \u0438 \u043A\u043E\u0440\u043E\u0432\u0438\u0439 \u0440\u043E\u0433)", "\u30C8\u30A5\u30EB\u30C8\u30A5\u30EB\u30AB\uFF08\u6C34\u9053\u7BA1\u3068\u725B\u306E\u89D2\uFF09", "\uD2B8\uB8E8\uD2B8\uB8E8\uCE74 (\uC218\uB3C4\uAD00\uACFC \uC18C\uBFD4)", "trutruka\uFF08\u6C34\u7BA1\u4E0E\u725B\u89D2\uFF09", "\u0E15\u0E23\u0E39\u0E15\u0E23\u0E39\u0E01\u0E32 (\u0E17\u0E48\u0E2D\u0E1B\u0E23\u0E30\u0E1B\u0E32\u0E41\u0E25\u0E30\u0E40\u0E02\u0E32\u0E27\u0E31\u0E27)"],
  "\xD1olki\xF1 de ca\xF1er\xEDa (gas y cacho de cabra)": ["\xD1olki\xF1, pipe (gas pipe and goat horn)", "\xD1olki\xF1 de cano (g\xE1s e chifre de cabra)", "\xD1olki\xF1 en tuyau (gaz et corne de ch\xE8vre)", "Hodizko \xF1olki\xF1a (gas-hodia eta ahuntz-adarra)", "\u041D\u044C\u043E\u043B\u044C\u043A\u0438\u043D\u044C \u0438\u0437 \u0442\u0440\u0443\u0431\u044B (\u0433\u0430\u0437\u043E\u0432\u0430\u044F \u0442\u0440\u0443\u0431\u0430 \u0438 \u043A\u043E\u0437\u0438\u0439 \u0440\u043E\u0433)", "\u30CB\u30E7\u30EB\u30AD\u30F3\u30FB\u7BA1\uFF08\u30AC\u30B9\u7BA1\u3068\u30E4\u30AE\u306E\u89D2\uFF09", "\uAD00 \uB1F0\uD0A8 (\uAC00\uC2A4\uAD00\uACFC \uC5FC\uC18C \uBFD4)", "\u7BA1\u5236 \xF1olki\xF1\uFF08\u71C3\u6C14\u7BA1\u4E0E\u5C71\u7F8A\u89D2\uFF09", "\u0E0D\u0E2D\u0E25\u0E01\u0E34\u0E0D\u0E17\u0E48\u0E2D (\u0E17\u0E48\u0E2D\u0E41\u0E01\u0E4A\u0E2A\u0E41\u0E25\u0E30\u0E40\u0E02\u0E32\u0E41\u0E1E\u0E30)"],
  "\xD1olki\xF1 de tallo (con cono de hoja)": ["\xD1olki\xF1, stalk (with leaf cone)", "\xD1olki\xF1 de talo (com cone de folha)", "\xD1olki\xF1 en tige (avec c\xF4ne de feuille)", "Zurtoinezko \xF1olki\xF1a (hosto-konoarekin)", "\u041D\u044C\u043E\u043B\u044C\u043A\u0438\u043D\u044C \u0438\u0437 \u0441\u0442\u0435\u0431\u043B\u044F (\u0441 \u043A\u043E\u043D\u0443\u0441\u043E\u043C \u0438\u0437 \u043B\u0438\u0441\u0442\u0430)", "\u30CB\u30E7\u30EB\u30AD\u30F3\u30FB\u830E\uFF08\u8449\u306E\u5186\u9310\u3064\u304D\uFF09", "\uC904\uAE30 \uB1F0\uD0A8 (\uC78E \uC6D0\uBFD4)", "\u830E\u5236 \xF1olki\xF1\uFF08\u5E26\u53F6\u5377\u9525\uFF09", "\u0E0D\u0E2D\u0E25\u0E01\u0E34\u0E0D\u0E25\u0E33\u0E15\u0E49\u0E19 (\u0E21\u0E35\u0E01\u0E23\u0E27\u0E22\u0E43\u0E1A\u0E44\u0E21\u0E49)"],
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
  General: ["General", "Geral", "G\xE9n\xE9ral", "Orokorra", "\u041E\u0431\u0449\u0435\u0435", "\u5168\u822C", "\uC77C\uBC18", "\u5E38\u89C4", "\u0E17\u0E31\u0E48\u0E27\u0E44\u0E1B"],
  Color: ["Color", "Cor", "Couleur", "Kolorea", "\u041E\u043A\u0440\u0430\u0441\u043A\u0430", "\u30AB\u30E9\u30FC", "\uCEEC\uB7EC", "\u97F3\u8272", "\u0E2A\u0E35\u0E2A\u0E31\u0E19"],
  "Vaiv\xE9n 1": ["LFO 1", "LFO 1", "LFO 1", "LFO 1", "LFO 1", "LFO 1", "LFO 1", "LFO 1", "LFO 1"],
  "Vaiv\xE9n 2": ["LFO 2", "LFO 2", "LFO 2", "LFO 2", "LFO 2", "LFO 2", "LFO 2", "LFO 2", "LFO 2"],
  Corte: ["Cutoff", "Corte", "Coupure", "Ebaketa", "\u0421\u0440\u0435\u0437", "\u30AB\u30C3\u30C8\u30AA\u30D5", "\uCEF7\uC624\uD504", "\u622A\u6B62", "\u0E04\u0E31\u0E15\u0E2D\u0E2D\u0E1F"],
  Envolvente: ["Envelope", "Envelope", "Enveloppe", "Inguratzailea", "\u041E\u0433\u0438\u0431\u0430\u044E\u0449\u0430\u044F", "\u30A8\u30F3\u30D9\u30ED\u30FC\u30D7", "\uC5D4\uBC8C\uB85C\uD504", "\u5305\u7EDC", "\u0E40\u0E2D\u0E19\u0E40\u0E27\u0E42\u0E25\u0E1B"],
  "Envolvente del filtro": ["Filter envelope", "Envelope do filtro", "Enveloppe du filtre", "Iragazkiaren inguratzailea", "\u041E\u0433\u0438\u0431\u0430\u044E\u0449\u0430\u044F \u0444\u0438\u043B\u044C\u0442\u0440\u0430", "\u30D5\u30A3\u30EB\u30BF\u30FC\u30A8\u30F3\u30D9\u30ED\u30FC\u30D7", "\uD544\uD130 \uC5D4\uBC8C\uB85C\uD504", "\u6EE4\u6CE2\u5668\u5305\u7EDC", "\u0E40\u0E2D\u0E19\u0E40\u0E27\u0E42\u0E25\u0E1B\u0E02\u0E2D\u0E07\u0E1F\u0E34\u0E25\u0E40\u0E15\u0E2D\u0E23\u0E4C"],
  "Ataque del filtro": ["Filter attack", "Ataque do filtro", "Attaque du filtre", "Iragazkiaren erasoa", "\u0410\u0442\u0430\u043A\u0430 \u0444\u0438\u043B\u044C\u0442\u0440\u0430", "\u30D5\u30A3\u30EB\u30BF\u30FC\u306E\u30A2\u30BF\u30C3\u30AF", "\uD544\uD130 \uC5B4\uD0DD", "\u6EE4\u6CE2\u5668\u8D77\u97F3", "\u0E41\u0E2D\u0E17\u0E41\u0E17\u0E04\u0E02\u0E2D\u0E07\u0E1F\u0E34\u0E25\u0E40\u0E15\u0E2D\u0E23\u0E4C"],
  Ca\u00EDda: ["Decay", "Queda", "Chute", "Jaitsiera", "\u0421\u043F\u0430\u0434", "\u30C7\u30A3\u30B1\u30A4", "\uB514\uCF00\uC774", "\u8870\u51CF", "\u0E14\u0E35\u0E40\u0E04\u0E22\u0E4C"],
  "Ca\xEDda del filtro": ["Filter decay", "Queda do filtro", "Chute du filtre", "Iragazkiaren jaitsiera", "\u0421\u043F\u0430\u0434 \u0444\u0438\u043B\u044C\u0442\u0440\u0430", "\u30D5\u30A3\u30EB\u30BF\u30FC\u306E\u30C7\u30A3\u30B1\u30A4", "\uD544\uD130 \uB514\uCF00\uC774", "\u6EE4\u6CE2\u5668\u8870\u51CF", "\u0E14\u0E35\u0E40\u0E04\u0E22\u0E4C\u0E02\u0E2D\u0E07\u0E1F\u0E34\u0E25\u0E40\u0E15\u0E2D\u0E23\u0E4C"],
  Distorsi\u00F3n: ["Distortion", "Distor\xE7\xE3o", "Distorsion", "Distortsioa", "\u0418\u0441\u043A\u0430\u0436\u0435\u043D\u0438\u0435", "\u30C7\u30A3\u30B9\u30C8\u30FC\u30B7\u30E7\u30F3", "\uB514\uC2A4\uD1A0\uC158", "\u5931\u771F", "\u0E14\u0E34\u0E2A\u0E17\u0E2D\u0E23\u0E4C\u0E0A\u0E31\u0E19"],
  "Mezcla de la distorsi\xF3n": ["Distortion mix", "Mistura da distor\xE7\xE3o", "M\xE9lange de la distorsion", "Distortsioaren nahasketa", "\u041C\u0438\u043A\u0441 \u0438\u0441\u043A\u0430\u0436\u0435\u043D\u0438\u044F", "\u30C7\u30A3\u30B9\u30C8\u30FC\u30B7\u30E7\u30F3\u306E\u30DF\u30C3\u30AF\u30B9", "\uB514\uC2A4\uD1A0\uC158 \uBBF9\uC2A4", "\u5931\u771F\u6DF7\u5408", "\u0E21\u0E34\u0E01\u0E0B\u0E4C\u0E02\u0E2D\u0E07\u0E14\u0E34\u0E2A\u0E17\u0E2D\u0E23\u0E4C\u0E0A\u0E31\u0E19"],
  Ruido: ["Noise", "Ru\xEDdo", "Bruit", "Zarata", "\u0428\u0443\u043C", "\u30CE\u30A4\u30BA", "\uB178\uC774\uC988", "\u566A\u58F0", "\u0E19\u0E2D\u0E22\u0E2A\u0E4C"],
  Desafinado: ["Detune", "Desafina\xE7\xE3o", "D\xE9saccord", "Desafinazioa", "\u0420\u0430\u0441\u0441\u0442\u0440\u043E\u0439\u043A\u0430", "\u30C7\u30C1\u30E5\u30FC\u30F3", "\uB514\uD2A0", "\u5931\u8C10", "\u0E14\u0E35\u0E08\u0E39\u0E19"],
  Sub: ["Sub", "Sub", "Sub", "Sub", "\u0421\u0430\u0431", "\u30B5\u30D6", "\uC11C\uBE0C", "\u526F\u632F\u8361\u5668", "\u0E0B\u0E31\u0E1A"],
  Octava: ["Octave", "Oitava", "Octave", "Zortzidun", "\u041E\u043A\u0442\u0430\u0432\u0430", "\u30AA\u30AF\u30BF\u30FC\u30D6", "\uC625\uD0C0\uBE0C", "\u516B\u5EA6", "\u0E2D\u0E47\u0E2D\u0E01\u0E40\u0E17\u0E1F"],
  "Octava del sub": ["Sub octave", "Oitava do sub", "Octave du sub", "Subaren zortziduna", "\u041E\u043A\u0442\u0430\u0432\u0430 \u0441\u0430\u0431\u0430", "\u30B5\u30D6\u306E\u30AA\u30AF\u30BF\u30FC\u30D6", "\uC11C\uBE0C \uC625\uD0C0\uBE0C", "\u526F\u632F\u8361\u5668\u516B\u5EA6", "\u0E2D\u0E47\u0E2D\u0E01\u0E40\u0E17\u0E1F\u0E02\u0E2D\u0E07\u0E0B\u0E31\u0E1A"],
  "Forma del sub": ["Sub shape", "Forma do sub", "Forme du sub", "Subaren forma", "\u0424\u043E\u0440\u043C\u0430 \u0441\u0430\u0431\u0430", "\u30B5\u30D6\u306E\u6CE2\u5F62", "\uC11C\uBE0C \uD30C\uD615", "\u526F\u632F\u8361\u5668\u6CE2\u5F62", "\u0E23\u0E39\u0E1B\u0E04\u0E25\u0E37\u0E48\u0E19\u0E02\u0E2D\u0E07\u0E0B\u0E31\u0E1A"],
  Apagado: ["Off", "Desligado", "\xC9teint", "Itzalita", "\u0412\u044B\u043A\u043B.", "\u30AA\u30D5", "\uB054", "\u5173\u95ED", "\u0E1B\u0E34\u0E14"],
  Sierra: ["Saw", "Serra", "Scie", "Zerra", "\u041F\u0438\u043B\u0430", "\u30CE\u30B3\u30AE\u30EA", "\uD1B1\uB2C8", "\u952F\u9F7F", "\u0E1F\u0E31\u0E19\u0E40\u0E25\u0E37\u0E48\u0E2D\u0E22"],
  Azar: ["Random", "Aleat\xF3rio", "Al\xE9atoire", "Ausazkoa", "\u0421\u043B\u0443\u0447\u0430\u0439\u043D\u043E", "\u30E9\u30F3\u30C0\u30E0", "\uB79C\uB364", "\u968F\u673A", "\u0E2A\u0E38\u0E48\u0E21"],
  Altura: ["Pitch", "Altura", "Hauteur", "Altuera", "\u0412\u044B\u0441\u043E\u0442\u0430", "\u30D4\u30C3\u30C1", "\uD53C\uCE58", "\u97F3\u9AD8", "\u0E23\u0E30\u0E14\u0E31\u0E1A\u0E40\u0E2A\u0E35\u0E22\u0E07"],
  Destino: ["Target", "Destino", "Cible", "Helburua", "\u0426\u0435\u043B\u044C", "\u9001\u308A\u5148", "\uB300\uC0C1", "\u76EE\u6807", "\u0E1B\u0E25\u0E32\u0E22\u0E17\u0E32\u0E07"],
  "Forma del vaiv\xE9n 1": ["LFO 1 shape", "Forma do LFO 1", "Forme du LFO 1", "LFO 1aren forma", "\u0424\u043E\u0440\u043C\u0430 LFO 1", "LFO 1\u306E\u6CE2\u5F62", "LFO 1 \uD30C\uD615", "LFO 1 \u6CE2\u5F62", "\u0E23\u0E39\u0E1B\u0E04\u0E25\u0E37\u0E48\u0E19\u0E02\u0E2D\u0E07 LFO 1"],
  "Forma del vaiv\xE9n 2": ["LFO 2 shape", "Forma do LFO 2", "Forme du LFO 2", "LFO 2aren forma", "\u0424\u043E\u0440\u043C\u0430 LFO 2", "LFO 2\u306E\u6CE2\u5F62", "LFO 2 \uD30C\uD615", "LFO 2 \u6CE2\u5F62", "\u0E23\u0E39\u0E1B\u0E04\u0E25\u0E37\u0E48\u0E19\u0E02\u0E2D\u0E07 LFO 2"],
  "Velocidad del vaiv\xE9n 1": ["LFO 1 rate", "Velocidade do LFO 1", "Vitesse du LFO 1", "LFO 1aren abiadura", "\u0421\u043A\u043E\u0440\u043E\u0441\u0442\u044C LFO 1", "LFO 1\u306E\u901F\u3055", "LFO 1 \uC18D\uB3C4", "LFO 1 \u901F\u7387", "\u0E04\u0E27\u0E32\u0E21\u0E40\u0E23\u0E47\u0E27\u0E02\u0E2D\u0E07 LFO 1"],
  "Velocidad del vaiv\xE9n 2": ["LFO 2 rate", "Velocidade do LFO 2", "Vitesse du LFO 2", "LFO 2aren abiadura", "\u0421\u043A\u043E\u0440\u043E\u0441\u0442\u044C LFO 2", "LFO 2\u306E\u901F\u3055", "LFO 2 \uC18D\uB3C4", "LFO 2 \u901F\u7387", "\u0E04\u0E27\u0E32\u0E21\u0E40\u0E23\u0E47\u0E27\u0E02\u0E2D\u0E07 LFO 2"],
  "Profundidad del vaiv\xE9n 1": ["LFO 1 depth", "Profundidade do LFO 1", "Profondeur du LFO 1", "LFO 1aren sakonera", "\u0413\u043B\u0443\u0431\u0438\u043D\u0430 LFO 1", "LFO 1\u306E\u6DF1\u3055", "LFO 1 \uAE4A\uC774", "LFO 1 \u6DF1\u5EA6", "\u0E04\u0E27\u0E32\u0E21\u0E25\u0E36\u0E01\u0E02\u0E2D\u0E07 LFO 1"],
  "Profundidad del vaiv\xE9n 2": ["LFO 2 depth", "Profundidade do LFO 2", "Profondeur du LFO 2", "LFO 2aren sakonera", "\u0413\u043B\u0443\u0431\u0438\u043D\u0430 LFO 2", "LFO 2\u306E\u6DF1\u3055", "LFO 2 \uAE4A\uC774", "LFO 2 \u6DF1\u5EA6", "\u0E04\u0E27\u0E32\u0E21\u0E25\u0E36\u0E01\u0E02\u0E2D\u0E07 LFO 2"],
  "Destino del vaiv\xE9n 1": ["LFO 1 target", "Destino do LFO 1", "Cible du LFO 1", "LFO 1aren helburua", "\u0426\u0435\u043B\u044C LFO 1", "LFO 1\u306E\u9001\u308A\u5148", "LFO 1 \uB300\uC0C1", "LFO 1 \u76EE\u6807", "\u0E1B\u0E25\u0E32\u0E22\u0E17\u0E32\u0E07\u0E02\u0E2D\u0E07 LFO 1"],
  "Destino del vaiv\xE9n 2": ["LFO 2 target", "Destino do LFO 2", "Cible du LFO 2", "LFO 2aren helburua", "\u0426\u0435\u043B\u044C LFO 2", "LFO 2\u306E\u9001\u308A\u5148", "LFO 2 \uB300\uC0C1", "LFO 2 \u76EE\u6807", "\u0E1B\u0E25\u0E32\u0E22\u0E17\u0E32\u0E07\u0E02\u0E2D\u0E07 LFO 2"],
  "Estirar al tempo": ["Stretch to tempo", "Esticar ao tempo", "\xC9tirer au tempo", "Tempora luzatu", "\u0420\u0430\u0441\u0442\u044F\u043D\u0443\u0442\u044C \u043F\u043E\u0434 \u0442\u0435\u043C\u043F", "\u30C6\u30F3\u30DD\u306B\u5408\u308F\u305B\u3066\u4F38\u7E2E", "\uD15C\uD3EC\uC5D0 \uB9DE\uCDB0 \uB298\uC774\uAE30", "\u6309\u901F\u5EA6\u4F38\u7F29", "\u0E22\u0E37\u0E14\u0E15\u0E32\u0E21\u0E08\u0E31\u0E07\u0E2B\u0E27\u0E30"],
  "Sin estirar": ["No stretch", "Sem esticar", "Sans \xE9tirer", "Luzatu gabe", "\u0411\u0435\u0437 \u0440\u0430\u0441\u0442\u044F\u0436\u0435\u043D\u0438\u044F", "\u4F38\u7E2E\u306A\u3057", "\uB298\uC774\uC9C0 \uC54A\uC74C", "\u4E0D\u4F38\u7F29", "\u0E44\u0E21\u0E48\u0E22\u0E37\u0E14"],
  Tiempos: ["Beats", "Tempos", "Temps", "Taupadak", "\u0414\u043E\u043B\u0438", "\u62CD", "\uBC15", "\u62CD", "\u0E08\u0E31\u0E07\u0E2B\u0E27\u0E30"],
  Fuente: ["Source", "Fonte", "Source", "Iturria", "\u0418\u0441\u0442\u043E\u0447\u043D\u0438\u043A", "\u30BD\u30FC\u30B9", "\uC18C\uC2A4", "\u6765\u6E90", "\u0E41\u0E2B\u0E25\u0E48\u0E07\u0E40\u0E2A\u0E35\u0E22\u0E07"],
  Audio: ["Audio", "\xC1udio", "Audio", "Audioa", "\u0410\u0443\u0434\u0438\u043E", "\u30AA\u30FC\u30C7\u30A3\u30AA", "\uC624\uB514\uC624", "\u97F3\u9891", "\u0E40\u0E2A\u0E35\u0E22\u0E07"],
  Oscilador: ["Oscillator", "Oscilador", "Oscillateur", "Osziladorea", "\u041E\u0441\u0446\u0438\u043B\u043B\u044F\u0442\u043E\u0440", "\u30AA\u30B7\u30EC\u30FC\u30BF\u30FC", "\uC624\uC2E4\uB808\uC774\uD130", "\u632F\u8361\u5668", "\u0E2D\u0E2D\u0E2A\u0E0B\u0E34\u0E25\u0E40\u0E25\u0E40\u0E15\u0E2D\u0E23\u0E4C"],
  Milisegundos: ["Milliseconds", "Milissegundos", "Millisecondes", "Milisegundoak", "\u041C\u0438\u043B\u043B\u0438\u0441\u0435\u043A\u0443\u043D\u0434\u044B", "\u30DF\u30EA\u79D2", "\uBC00\uB9AC\uCD08", "\u6BEB\u79D2", "\u0E21\u0E34\u0E25\u0E25\u0E34\u0E27\u0E34\u0E19\u0E32\u0E17\u0E35"],
  "Desde Pizarrita": ["From Pizarrita", "Do Pizarrita", "Depuis Pizarrita", "Pizarritatik", "\u0418\u0437 Pizarrita", "Pizarrita\u304B\u3089", "Pizarrita\uC5D0\uC11C", "\u4ECE Pizarrita", "\u0E08\u0E32\u0E01 Pizarrita"],
  Moldear: ["Shape", "Moldar", "Fa\xE7onner", "Moldatu", "\u0424\u043E\u0440\u043C\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435", "\u97F3\u4F5C\u308A", "\uC74C\uC0C9 \uB2E4\uB4EC\uAE30", "\u5851\u9020", "\u0E1B\u0E23\u0E31\u0E1A\u0E41\u0E15\u0E48\u0E07\u0E40\u0E2A\u0E35\u0E22\u0E07"],
  "Intensidad de la nota": ["Velocity", "Intensidade da nota", "V\xE9locit\xE9", "Notaren indarra", "\u0421\u0438\u043B\u0430 \u043D\u0430\u0436\u0430\u0442\u0438\u044F", "\u30D9\u30ED\u30B7\u30C6\u30A3", "\uBCA8\uB85C\uC2DC\uD2F0", "\u529B\u5EA6", "\u0E04\u0E27\u0E32\u0E21\u0E41\u0E23\u0E07\u0E02\u0E2D\u0E07\u0E42\u0E19\u0E49\u0E15"],
  Tecla: ["Key", "Tecla", "Touche", "Tekla", "\u041A\u043B\u0430\u0432\u0438\u0448\u0430", "\u30AD\u30FC", "\uAC74\uBC18", "\u7434\u952E", "\u0E04\u0E35\u0E22\u0E4C"],
  Tiempo: ["Time", "Tempo", "Temps", "Denbora", "\u0412\u0440\u0435\u043C\u044F", "\u30BF\u30A4\u30E0", "\uD0C0\uC784", "\u65F6\u95F4", "\u0E40\u0E27\u0E25\u0E32"],
  Nivel: ["Level", "N\xEDvel", "Niveau", "Maila", "\u0423\u0440\u043E\u0432\u0435\u043D\u044C", "\u30EC\u30D9\u30EB", "\uB808\uBCA8", "\u7535\u5E73", "\u0E23\u0E30\u0E14\u0E31\u0E1A"],
  "Retardo de entrada": ["Start delay", "Atraso de entrada", "Retard de d\xE9part", "Hasierako atzerapena", "\u0417\u0430\u0434\u0435\u0440\u0436\u043A\u0430 \u043D\u0430\u0447\u0430\u043B\u0430", "\u30B9\u30BF\u30FC\u30C8\u30FB\u30C7\u30A3\u30EC\u30A4", "\uC2DC\uC791 \uC9C0\uC5F0", "\u8D77\u59CB\u5EF6\u8FDF", "\u0E2B\u0E19\u0E48\u0E27\u0E07\u0E40\u0E27\u0E25\u0E32\u0E40\u0E23\u0E34\u0E48\u0E21\u0E15\u0E49\u0E19"],
  "Nivel de ataque": ["Attack level", "N\xEDvel de ataque", "Niveau d\u2019attaque", "Eraso-maila", "\u0423\u0440\u043E\u0432\u0435\u043D\u044C \u0430\u0442\u0430\u043A\u0438", "\u30A2\u30BF\u30C3\u30AF\u30FB\u30EC\u30D9\u30EB", "\uC5B4\uD0DD \uB808\uBCA8", "\u8D77\u97F3\u7535\u5E73", "\u0E23\u0E30\u0E14\u0E31\u0E1A\u0E41\u0E2D\u0E17\u0E41\u0E17\u0E04"],
  Quiebre: ["Break point", "Ponto de quebra", "Point de rupture", "Haustura-puntua", "\u0422\u043E\u0447\u043A\u0430 \u043F\u0435\u0440\u0435\u0433\u0438\u0431\u0430", "\u30D6\u30EC\u30A4\u30AF\u30FB\u30DD\u30A4\u30F3\u30C8", "\uBE0C\uB808\uC774\uD06C \uD3EC\uC778\uD2B8", "\u65AD\u70B9", "\u0E08\u0E38\u0E14\u0E2B\u0E31\u0E01\u0E40\u0E2B"],
  Intensidad: ["Intensity", "Intensidade", "Intensit\xE9", "Intentsitatea", "\u0418\u043D\u0442\u0435\u043D\u0441\u0438\u0432\u043D\u043E\u0441\u0442\u044C", "\u30A4\u30F3\u30C6\u30F3\u30B7\u30C6\u30A3", "\uAC15\uB3C4", "\u5F3A\u5EA6", "\u0E04\u0E27\u0E32\u0E21\u0E40\u0E02\u0E49\u0E21"],
  "Nivel inicial": ["Start level", "N\xEDvel inicial", "Niveau initial", "Hasierako maila", "\u041D\u0430\u0447\u0430\u043B\u044C\u043D\u044B\u0439 \u0443\u0440\u043E\u0432\u0435\u043D\u044C", "\u30B9\u30BF\u30FC\u30C8\u30FB\u30EC\u30D9\u30EB", "\uC2DC\uC791 \uB808\uBCA8", "\u8D77\u59CB\u7535\u5E73", "\u0E23\u0E30\u0E14\u0E31\u0E1A\u0E40\u0E23\u0E34\u0E48\u0E21\u0E15\u0E49\u0E19"],
  "Nivel final": ["Release level", "N\xEDvel final", "Niveau final", "Amaierako maila", "\u041A\u043E\u043D\u0435\u0447\u043D\u044B\u0439 \u0443\u0440\u043E\u0432\u0435\u043D\u044C", "\u30EA\u30EA\u30FC\u30B9\u30FB\u30EC\u30D9\u30EB", "\uB9B4\uB9AC\uC2A4 \uB808\uBCA8", "\u91CA\u653E\u7535\u5E73", "\u0E23\u0E30\u0E14\u0E31\u0E1A\u0E2A\u0E38\u0E14\u0E17\u0E49\u0E32\u0E22"],
  "Ataque del volumen": ["Amp attack", "Ataque do volume", "Attaque du volume", "Bolumenaren erasoa", "\u0410\u0442\u0430\u043A\u0430 \u0433\u0440\u043E\u043C\u043A\u043E\u0441\u0442\u0438", "\u30A2\u30F3\u30D7\u306E\u30A2\u30BF\u30C3\u30AF", "\uC570\uD504 \uC5B4\uD0DD", "\u97F3\u91CF\u8D77\u97F3", "\u0E41\u0E2D\u0E17\u0E41\u0E17\u0E04\u0E02\u0E2D\u0E07\u0E23\u0E30\u0E14\u0E31\u0E1A\u0E40\u0E2A\u0E35\u0E22\u0E07"],
  "Nivel de ataque del volumen": ["Amp attack level", "N\xEDvel de ataque do volume", "Niveau d\u2019attaque du volume", "Bolumenaren eraso-maila", "\u0423\u0440\u043E\u0432\u0435\u043D\u044C \u0430\u0442\u0430\u043A\u0438 \u0433\u0440\u043E\u043C\u043A\u043E\u0441\u0442\u0438", "\u30A2\u30F3\u30D7\u306E\u30A2\u30BF\u30C3\u30AF\u30FB\u30EC\u30D9\u30EB", "\uC570\uD504 \uC5B4\uD0DD \uB808\uBCA8", "\u97F3\u91CF\u8D77\u97F3\u7535\u5E73", "\u0E23\u0E30\u0E14\u0E31\u0E1A\u0E41\u0E2D\u0E17\u0E41\u0E17\u0E04\u0E02\u0E2D\u0E07\u0E23\u0E30\u0E14\u0E31\u0E1A\u0E40\u0E2A\u0E35\u0E22\u0E07"],
  "Decaimiento del volumen": ["Amp decay", "Decaimento do volume", "D\xE9clin du volume", "Bolumenaren beherakada", "\u0421\u043F\u0430\u0434 \u0433\u0440\u043E\u043C\u043A\u043E\u0441\u0442\u0438", "\u30A2\u30F3\u30D7\u306E\u30C7\u30A3\u30B1\u30A4", "\uC570\uD504 \uB514\uCF00\uC774", "\u97F3\u91CF\u8870\u51CF", "\u0E14\u0E35\u0E40\u0E04\u0E22\u0E4C\u0E02\u0E2D\u0E07\u0E23\u0E30\u0E14\u0E31\u0E1A\u0E40\u0E2A\u0E35\u0E22\u0E07"],
  "Quiebre del volumen": ["Amp break point", "Ponto de quebra do volume", "Point de rupture du volume", "Bolumenaren haustura-puntua", "\u0422\u043E\u0447\u043A\u0430 \u043F\u0435\u0440\u0435\u0433\u0438\u0431\u0430 \u0433\u0440\u043E\u043C\u043A\u043E\u0441\u0442\u0438", "\u30A2\u30F3\u30D7\u306E\u30D6\u30EC\u30A4\u30AF\u30FB\u30DD\u30A4\u30F3\u30C8", "\uC570\uD504 \uBE0C\uB808\uC774\uD06C \uD3EC\uC778\uD2B8", "\u97F3\u91CF\u65AD\u70B9", "\u0E08\u0E38\u0E14\u0E2B\u0E31\u0E01\u0E40\u0E2B\u0E02\u0E2D\u0E07\u0E23\u0E30\u0E14\u0E31\u0E1A\u0E40\u0E2A\u0E35\u0E22\u0E07"],
  "Pendiente del volumen": ["Amp slope", "Inclina\xE7\xE3o do volume", "Pente du volume", "Bolumenaren malda", "\u041D\u0430\u043A\u043B\u043E\u043D \u0433\u0440\u043E\u043C\u043A\u043E\u0441\u0442\u0438", "\u30A2\u30F3\u30D7\u306E\u30B9\u30ED\u30FC\u30D7", "\uC570\uD504 \uC2AC\uB85C\uD504", "\u97F3\u91CF\u659C\u7387", "\u0E2A\u0E42\u0E25\u0E1B\u0E02\u0E2D\u0E07\u0E23\u0E30\u0E14\u0E31\u0E1A\u0E40\u0E2A\u0E35\u0E22\u0E07"],
  "Sostenido del volumen": ["Amp sustain", "Sustenta\xE7\xE3o do volume", "Maintien du volume", "Bolumenaren iraupena", "\u0421\u0443\u0441\u0442\u0435\u0439\u043D \u0433\u0440\u043E\u043C\u043A\u043E\u0441\u0442\u0438", "\u30A2\u30F3\u30D7\u306E\u30B5\u30B9\u30C6\u30A4\u30F3", "\uC570\uD504 \uC11C\uC2A4\uD14C\uC778", "\u97F3\u91CF\u5EF6\u97F3", "\u0E0B\u0E31\u0E2A\u0E40\u0E17\u0E19\u0E02\u0E2D\u0E07\u0E23\u0E30\u0E14\u0E31\u0E1A\u0E40\u0E2A\u0E35\u0E22\u0E07"],
  "Soltado del volumen": ["Amp release", "Libera\xE7\xE3o do volume", "Rel\xE2chement du volume", "Bolumenaren askatzea", "\u0417\u0430\u0442\u0443\u0445\u0430\u043D\u0438\u0435 \u0433\u0440\u043E\u043C\u043A\u043E\u0441\u0442\u0438", "\u30A2\u30F3\u30D7\u306E\u30EA\u30EA\u30FC\u30B9", "\uC570\uD504 \uB9B4\uB9AC\uC2A4", "\u97F3\u91CF\u91CA\u653E", "\u0E23\u0E35\u0E25\u0E35\u0E2A\u0E02\u0E2D\u0E07\u0E23\u0E30\u0E14\u0E31\u0E1A\u0E40\u0E2A\u0E35\u0E22\u0E07"],
  "Sensibilidad del volumen": ["Amp velocity", "Sensibilidade do volume", "V\xE9locit\xE9 du volume", "Bolumenaren sentikortasuna", "\u0427\u0443\u0432\u0441\u0442\u0432\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u0433\u0440\u043E\u043C\u043A\u043E\u0441\u0442\u0438", "\u30A2\u30F3\u30D7\u306E\u30D9\u30ED\u30B7\u30C6\u30A3", "\uC570\uD504 \uBCA8\uB85C\uC2DC\uD2F0", "\u97F3\u91CF\u529B\u5EA6", "\u0E04\u0E27\u0E32\u0E21\u0E44\u0E27\u0E02\u0E2D\u0E07\u0E23\u0E30\u0E14\u0E31\u0E1A\u0E40\u0E2A\u0E35\u0E22\u0E07"],
  "Tiempos del volumen por intensidad": ["Amp EG time by velocity", "Tempos do volume pela intensidade", "Temps du volume selon la v\xE9locit\xE9", "Bolumenaren denborak indarraren arabera", "\u0412\u0440\u0435\u043C\u044F \u0433\u0440\u043E\u043C\u043A\u043E\u0441\u0442\u0438 \u043E\u0442 \u0441\u0438\u043B\u044B \u043D\u0430\u0436\u0430\u0442\u0438\u044F", "\u30A2\u30F3\u30D7EG\u30BF\u30A4\u30E0(\u30D9\u30ED\u30B7\u30C6\u30A3)", "\uBCA8\uB85C\uC2DC\uD2F0\uC5D0 \uB530\uB978 \uC570\uD504 EG \uD0C0\uC784", "\u529B\u5EA6\u63A7\u5236\u97F3\u91CF\u5305\u7EDC\u65F6\u95F4", "\u0E40\u0E27\u0E25\u0E32\u0E40\u0E2D\u0E19\u0E40\u0E27\u0E42\u0E25\u0E1B\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E15\u0E32\u0E21\u0E04\u0E27\u0E32\u0E21\u0E41\u0E23\u0E07"],
  "Tiempos del volumen por tecla": ["Amp EG time by key", "Tempos do volume pela tecla", "Temps du volume selon la touche", "Bolumenaren denborak teklaren arabera", "\u0412\u0440\u0435\u043C\u044F \u0433\u0440\u043E\u043C\u043A\u043E\u0441\u0442\u0438 \u043E\u0442 \u043A\u043B\u0430\u0432\u0438\u0448\u0438", "\u30A2\u30F3\u30D7EG\u30BF\u30A4\u30E0(\u30AD\u30FC)", "\uAC74\uBC18\uC5D0 \uB530\uB978 \uC570\uD504 EG \uD0C0\uC784", "\u7434\u952E\u63A7\u5236\u97F3\u91CF\u5305\u7EDC\u65F6\u95F4", "\u0E40\u0E27\u0E25\u0E32\u0E40\u0E2D\u0E19\u0E40\u0E27\u0E42\u0E25\u0E1B\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E15\u0E32\u0E21\u0E04\u0E35\u0E22\u0E4C"],
  "Tipo de filtro": ["Filter type", "Tipo de filtro", "Type de filtre", "Iragazki mota", "\u0422\u0438\u043F \u0444\u0438\u043B\u044C\u0442\u0440\u0430", "\u30D5\u30A3\u30EB\u30BF\u30FC\u30FB\u30BF\u30A4\u30D7", "\uD544\uD130 \uD0C0\uC785", "\u6EE4\u6CE2\u5668\u7C7B\u578B", "\u0E0A\u0E19\u0E34\u0E14\u0E1F\u0E34\u0E25\u0E40\u0E15\u0E2D\u0E23\u0E4C"],
  "Intensidad del filtro": ["Filter EG intensity", "Intensidade do filtro", "Intensit\xE9 du filtre", "Iragazkiaren intentsitatea", "\u0413\u043B\u0443\u0431\u0438\u043D\u0430 \u043E\u0433\u0438\u0431\u0430\u044E\u0449\u0435\u0439 \u0444\u0438\u043B\u044C\u0442\u0440\u0430", "\u30D5\u30A3\u30EB\u30BF\u30FCEG\u30A4\u30F3\u30C6\u30F3\u30B7\u30C6\u30A3", "\uD544\uD130 EG \uAC15\uB3C4", "\u6EE4\u6CE2\u5668\u5305\u7EDC\u5F3A\u5EA6", "\u0E04\u0E27\u0E32\u0E21\u0E40\u0E02\u0E49\u0E21\u0E40\u0E2D\u0E19\u0E40\u0E27\u0E42\u0E25\u0E1B\u0E1F\u0E34\u0E25\u0E40\u0E15\u0E2D\u0E23\u0E4C"],
  "Nivel inicial del filtro": ["Filter start level", "N\xEDvel inicial do filtro", "Niveau initial du filtre", "Iragazkiaren hasierako maila", "\u041D\u0430\u0447\u0430\u043B\u044C\u043D\u044B\u0439 \u0443\u0440\u043E\u0432\u0435\u043D\u044C \u0444\u0438\u043B\u044C\u0442\u0440\u0430", "\u30D5\u30A3\u30EB\u30BF\u30FC\u306E\u30B9\u30BF\u30FC\u30C8\u30FB\u30EC\u30D9\u30EB", "\uD544\uD130 \uC2DC\uC791 \uB808\uBCA8", "\u6EE4\u6CE2\u5668\u8D77\u59CB\u7535\u5E73", "\u0E23\u0E30\u0E14\u0E31\u0E1A\u0E40\u0E23\u0E34\u0E48\u0E21\u0E15\u0E49\u0E19\u0E02\u0E2D\u0E07\u0E1F\u0E34\u0E25\u0E40\u0E15\u0E2D\u0E23\u0E4C"],
  "Nivel de ataque del filtro": ["Filter attack level", "N\xEDvel de ataque do filtro", "Niveau d\u2019attaque du filtre", "Iragazkiaren eraso-maila", "\u0423\u0440\u043E\u0432\u0435\u043D\u044C \u0430\u0442\u0430\u043A\u0438 \u0444\u0438\u043B\u044C\u0442\u0440\u0430", "\u30D5\u30A3\u30EB\u30BF\u30FC\u306E\u30A2\u30BF\u30C3\u30AF\u30FB\u30EC\u30D9\u30EB", "\uD544\uD130 \uC5B4\uD0DD \uB808\uBCA8", "\u6EE4\u6CE2\u5668\u8D77\u97F3\u7535\u5E73", "\u0E23\u0E30\u0E14\u0E31\u0E1A\u0E41\u0E2D\u0E17\u0E41\u0E17\u0E04\u0E02\u0E2D\u0E07\u0E1F\u0E34\u0E25\u0E40\u0E15\u0E2D\u0E23\u0E4C"],
  "Decaimiento del filtro": ["Filter decay", "Decaimento do filtro", "D\xE9clin du filtre", "Iragazkiaren beherakada", "\u0421\u043F\u0430\u0434 \u0444\u0438\u043B\u044C\u0442\u0440\u0430", "\u30D5\u30A3\u30EB\u30BF\u30FC\u306E\u30C7\u30A3\u30B1\u30A4", "\uD544\uD130 \uB514\uCF00\uC774", "\u6EE4\u6CE2\u5668\u8870\u51CF", "\u0E14\u0E35\u0E40\u0E04\u0E22\u0E4C\u0E02\u0E2D\u0E07\u0E1F\u0E34\u0E25\u0E40\u0E15\u0E2D\u0E23\u0E4C"],
  "Quiebre del filtro": ["Filter break point", "Ponto de quebra do filtro", "Point de rupture du filtre", "Iragazkiaren haustura-puntua", "\u0422\u043E\u0447\u043A\u0430 \u043F\u0435\u0440\u0435\u0433\u0438\u0431\u0430 \u0444\u0438\u043B\u044C\u0442\u0440\u0430", "\u30D5\u30A3\u30EB\u30BF\u30FC\u306E\u30D6\u30EC\u30A4\u30AF\u30FB\u30DD\u30A4\u30F3\u30C8", "\uD544\uD130 \uBE0C\uB808\uC774\uD06C \uD3EC\uC778\uD2B8", "\u6EE4\u6CE2\u5668\u65AD\u70B9", "\u0E08\u0E38\u0E14\u0E2B\u0E31\u0E01\u0E40\u0E2B\u0E02\u0E2D\u0E07\u0E1F\u0E34\u0E25\u0E40\u0E15\u0E2D\u0E23\u0E4C"],
  "Pendiente del filtro": ["Filter slope", "Inclina\xE7\xE3o do filtro", "Pente du filtre", "Iragazkiaren malda", "\u041D\u0430\u043A\u043B\u043E\u043D \u0444\u0438\u043B\u044C\u0442\u0440\u0430", "\u30D5\u30A3\u30EB\u30BF\u30FC\u306E\u30B9\u30ED\u30FC\u30D7", "\uD544\uD130 \uC2AC\uB85C\uD504", "\u6EE4\u6CE2\u5668\u659C\u7387", "\u0E2A\u0E42\u0E25\u0E1B\u0E02\u0E2D\u0E07\u0E1F\u0E34\u0E25\u0E40\u0E15\u0E2D\u0E23\u0E4C"],
  "Sostenido del filtro": ["Filter sustain", "Sustenta\xE7\xE3o do filtro", "Maintien du filtre", "Iragazkiaren iraupena", "\u0421\u0443\u0441\u0442\u0435\u0439\u043D \u0444\u0438\u043B\u044C\u0442\u0440\u0430", "\u30D5\u30A3\u30EB\u30BF\u30FC\u306E\u30B5\u30B9\u30C6\u30A4\u30F3", "\uD544\uD130 \uC11C\uC2A4\uD14C\uC778", "\u6EE4\u6CE2\u5668\u5EF6\u97F3", "\u0E0B\u0E31\u0E2A\u0E40\u0E17\u0E19\u0E02\u0E2D\u0E07\u0E1F\u0E34\u0E25\u0E40\u0E15\u0E2D\u0E23\u0E4C"],
  "Soltado del filtro": ["Filter release", "Libera\xE7\xE3o do filtro", "Rel\xE2chement du filtre", "Iragazkiaren askatzea", "\u0417\u0430\u0442\u0443\u0445\u0430\u043D\u0438\u0435 \u0444\u0438\u043B\u044C\u0442\u0440\u0430", "\u30D5\u30A3\u30EB\u30BF\u30FC\u306E\u30EA\u30EA\u30FC\u30B9", "\uD544\uD130 \uB9B4\uB9AC\uC2A4", "\u6EE4\u6CE2\u5668\u91CA\u653E", "\u0E23\u0E35\u0E25\u0E35\u0E2A\u0E02\u0E2D\u0E07\u0E1F\u0E34\u0E25\u0E40\u0E15\u0E2D\u0E23\u0E4C"],
  "Nivel final del filtro": ["Filter release level", "N\xEDvel final do filtro", "Niveau final du filtre", "Iragazkiaren amaierako maila", "\u041A\u043E\u043D\u0435\u0447\u043D\u044B\u0439 \u0443\u0440\u043E\u0432\u0435\u043D\u044C \u0444\u0438\u043B\u044C\u0442\u0440\u0430", "\u30D5\u30A3\u30EB\u30BF\u30FC\u306E\u30EA\u30EA\u30FC\u30B9\u30FB\u30EC\u30D9\u30EB", "\uD544\uD130 \uB9B4\uB9AC\uC2A4 \uB808\uBCA8", "\u6EE4\u6CE2\u5668\u91CA\u653E\u7535\u5E73", "\u0E23\u0E30\u0E14\u0E31\u0E1A\u0E2A\u0E38\u0E14\u0E17\u0E49\u0E32\u0E22\u0E02\u0E2D\u0E07\u0E1F\u0E34\u0E25\u0E40\u0E15\u0E2D\u0E23\u0E4C"],
  "Intensidad del filtro por intensidad": ["Filter EG intensity by velocity", "Intensidade do filtro pela intensidade", "Intensit\xE9 du filtre selon la v\xE9locit\xE9", "Iragazkiaren intentsitatea indarraren arabera", "\u0413\u043B\u0443\u0431\u0438\u043D\u0430 \u0444\u0438\u043B\u044C\u0442\u0440\u0430 \u043E\u0442 \u0441\u0438\u043B\u044B \u043D\u0430\u0436\u0430\u0442\u0438\u044F", "\u30D5\u30A3\u30EB\u30BF\u30FCEG\u30A4\u30F3\u30C6\u30F3\u30B7\u30C6\u30A3(\u30D9\u30ED\u30B7\u30C6\u30A3)", "\uBCA8\uB85C\uC2DC\uD2F0\uC5D0 \uB530\uB978 \uD544\uD130 EG \uAC15\uB3C4", "\u529B\u5EA6\u63A7\u5236\u6EE4\u6CE2\u5668\u5305\u7EDC\u5F3A\u5EA6", "\u0E04\u0E27\u0E32\u0E21\u0E40\u0E02\u0E49\u0E21\u0E1F\u0E34\u0E25\u0E40\u0E15\u0E2D\u0E23\u0E4C\u0E15\u0E32\u0E21\u0E04\u0E27\u0E32\u0E21\u0E41\u0E23\u0E07"],
  "Tiempos del filtro por intensidad": ["Filter EG time by velocity", "Tempos do filtro pela intensidade", "Temps du filtre selon la v\xE9locit\xE9", "Iragazkiaren denborak indarraren arabera", "\u0412\u0440\u0435\u043C\u044F \u0444\u0438\u043B\u044C\u0442\u0440\u0430 \u043E\u0442 \u0441\u0438\u043B\u044B \u043D\u0430\u0436\u0430\u0442\u0438\u044F", "\u30D5\u30A3\u30EB\u30BF\u30FCEG\u30BF\u30A4\u30E0(\u30D9\u30ED\u30B7\u30C6\u30A3)", "\uBCA8\uB85C\uC2DC\uD2F0\uC5D0 \uB530\uB978 \uD544\uD130 EG \uD0C0\uC784", "\u529B\u5EA6\u63A7\u5236\u6EE4\u6CE2\u5668\u5305\u7EDC\u65F6\u95F4", "\u0E40\u0E27\u0E25\u0E32\u0E40\u0E2D\u0E19\u0E40\u0E27\u0E42\u0E25\u0E1B\u0E1F\u0E34\u0E25\u0E40\u0E15\u0E2D\u0E23\u0E4C\u0E15\u0E32\u0E21\u0E04\u0E27\u0E32\u0E21\u0E41\u0E23\u0E07"],
  "Corte por tecla": ["Cutoff key tracking", "Corte pela tecla", "Coupure selon la touche", "Ebaketa teklaren arabera", "\u0421\u0440\u0435\u0437 \u043E\u0442 \u043A\u043B\u0430\u0432\u0438\u0448\u0438", "\u30AB\u30C3\u30C8\u30AA\u30D5\u30FB\u30AD\u30FC\u30C8\u30E9\u30C3\u30AF", "\uCEF7\uC624\uD504 \uD0A4 \uD2B8\uB798\uD0B9", "\u622A\u6B62\u9891\u7387\u952E\u76D8\u8DDF\u968F", "\u0E04\u0E31\u0E15\u0E2D\u0E2D\u0E1F\u0E15\u0E32\u0E21\u0E04\u0E35\u0E22\u0E4C"],
  "Tiempos del filtro por tecla": ["Filter EG time by key", "Tempos do filtro pela tecla", "Temps du filtre selon la touche", "Iragazkiaren denborak teklaren arabera", "\u0412\u0440\u0435\u043C\u044F \u0444\u0438\u043B\u044C\u0442\u0440\u0430 \u043E\u0442 \u043A\u043B\u0430\u0432\u0438\u0448\u0438", "\u30D5\u30A3\u30EB\u30BF\u30FCEG\u30BF\u30A4\u30E0(\u30AD\u30FC)", "\uAC74\uBC18\uC5D0 \uB530\uB978 \uD544\uD130 EG \uD0C0\uC784", "\u7434\u952E\u63A7\u5236\u6EE4\u6CE2\u5668\u5305\u7EDC\u65F6\u95F4", "\u0E40\u0E27\u0E25\u0E32\u0E40\u0E2D\u0E19\u0E40\u0E27\u0E42\u0E25\u0E1B\u0E1F\u0E34\u0E25\u0E40\u0E15\u0E2D\u0E23\u0E4C\u0E15\u0E32\u0E21\u0E04\u0E35\u0E22\u0E4C"],
  "Intensidad de la altura": ["Pitch EG intensity", "Intensidade da altura", "Intensit\xE9 de la hauteur", "Altueraren intentsitatea", "\u0413\u043B\u0443\u0431\u0438\u043D\u0430 \u043E\u0433\u0438\u0431\u0430\u044E\u0449\u0435\u0439 \u0432\u044B\u0441\u043E\u0442\u044B", "\u30D4\u30C3\u30C1EG\u30A4\u30F3\u30C6\u30F3\u30B7\u30C6\u30A3", "\uD53C\uCE58 EG \uAC15\uB3C4", "\u97F3\u9AD8\u5305\u7EDC\u5F3A\u5EA6", "\u0E04\u0E27\u0E32\u0E21\u0E40\u0E02\u0E49\u0E21\u0E40\u0E2D\u0E19\u0E40\u0E27\u0E42\u0E25\u0E1B\u0E23\u0E30\u0E14\u0E31\u0E1A\u0E40\u0E2A\u0E35\u0E22\u0E07"],
  "Nivel inicial de la altura": ["Pitch start level", "N\xEDvel inicial da altura", "Niveau initial de la hauteur", "Altueraren hasierako maila", "\u041D\u0430\u0447\u0430\u043B\u044C\u043D\u044B\u0439 \u0443\u0440\u043E\u0432\u0435\u043D\u044C \u0432\u044B\u0441\u043E\u0442\u044B", "\u30D4\u30C3\u30C1\u306E\u30B9\u30BF\u30FC\u30C8\u30FB\u30EC\u30D9\u30EB", "\uD53C\uCE58 \uC2DC\uC791 \uB808\uBCA8", "\u97F3\u9AD8\u8D77\u59CB\u7535\u5E73", "\u0E23\u0E30\u0E14\u0E31\u0E1A\u0E40\u0E23\u0E34\u0E48\u0E21\u0E15\u0E49\u0E19\u0E02\u0E2D\u0E07\u0E23\u0E30\u0E14\u0E31\u0E1A\u0E40\u0E2A\u0E35\u0E22\u0E07"],
  "Ataque de la altura": ["Pitch attack", "Ataque da altura", "Attaque de la hauteur", "Altueraren erasoa", "\u0410\u0442\u0430\u043A\u0430 \u0432\u044B\u0441\u043E\u0442\u044B", "\u30D4\u30C3\u30C1\u306E\u30A2\u30BF\u30C3\u30AF", "\uD53C\uCE58 \uC5B4\uD0DD", "\u97F3\u9AD8\u8D77\u97F3", "\u0E41\u0E2D\u0E17\u0E41\u0E17\u0E04\u0E02\u0E2D\u0E07\u0E23\u0E30\u0E14\u0E31\u0E1A\u0E40\u0E2A\u0E35\u0E22\u0E07 (\u0E1E\u0E34\u0E17\u0E0A\u0E4C)"],
  "Nivel de ataque de la altura": ["Pitch attack level", "N\xEDvel de ataque da altura", "Niveau d\u2019attaque de la hauteur", "Altueraren eraso-maila", "\u0423\u0440\u043E\u0432\u0435\u043D\u044C \u0430\u0442\u0430\u043A\u0438 \u0432\u044B\u0441\u043E\u0442\u044B", "\u30D4\u30C3\u30C1\u306E\u30A2\u30BF\u30C3\u30AF\u30FB\u30EC\u30D9\u30EB", "\uD53C\uCE58 \uC5B4\uD0DD \uB808\uBCA8", "\u97F3\u9AD8\u8D77\u97F3\u7535\u5E73", "\u0E23\u0E30\u0E14\u0E31\u0E1A\u0E41\u0E2D\u0E17\u0E41\u0E17\u0E04\u0E02\u0E2D\u0E07\u0E1E\u0E34\u0E17\u0E0A\u0E4C"],
  "Decaimiento de la altura": ["Pitch decay", "Decaimento da altura", "D\xE9clin de la hauteur", "Altueraren beherakada", "\u0421\u043F\u0430\u0434 \u0432\u044B\u0441\u043E\u0442\u044B", "\u30D4\u30C3\u30C1\u306E\u30C7\u30A3\u30B1\u30A4", "\uD53C\uCE58 \uB514\uCF00\uC774", "\u97F3\u9AD8\u8870\u51CF", "\u0E14\u0E35\u0E40\u0E04\u0E22\u0E4C\u0E02\u0E2D\u0E07\u0E1E\u0E34\u0E17\u0E0A\u0E4C"],
  "Soltado de la altura": ["Pitch release", "Libera\xE7\xE3o da altura", "Rel\xE2chement de la hauteur", "Altueraren askatzea", "\u0417\u0430\u0442\u0443\u0445\u0430\u043D\u0438\u0435 \u0432\u044B\u0441\u043E\u0442\u044B", "\u30D4\u30C3\u30C1\u306E\u30EA\u30EA\u30FC\u30B9", "\uD53C\uCE58 \uB9B4\uB9AC\uC2A4", "\u97F3\u9AD8\u91CA\u653E", "\u0E23\u0E35\u0E25\u0E35\u0E2A\u0E02\u0E2D\u0E07\u0E1E\u0E34\u0E17\u0E0A\u0E4C"],
  "Nivel final de la altura": ["Pitch release level", "N\xEDvel final da altura", "Niveau final de la hauteur", "Altueraren amaierako maila", "\u041A\u043E\u043D\u0435\u0447\u043D\u044B\u0439 \u0443\u0440\u043E\u0432\u0435\u043D\u044C \u0432\u044B\u0441\u043E\u0442\u044B", "\u30D4\u30C3\u30C1\u306E\u30EA\u30EA\u30FC\u30B9\u30FB\u30EC\u30D9\u30EB", "\uD53C\uCE58 \uB9B4\uB9AC\uC2A4 \uB808\uBCA8", "\u97F3\u9AD8\u91CA\u653E\u7535\u5E73", "\u0E23\u0E30\u0E14\u0E31\u0E1A\u0E2A\u0E38\u0E14\u0E17\u0E49\u0E32\u0E22\u0E02\u0E2D\u0E07\u0E1E\u0E34\u0E17\u0E0A\u0E4C"],
  "Intensidad de la altura por intensidad": ["Pitch EG intensity by velocity", "Intensidade da altura pela intensidade", "Intensit\xE9 de la hauteur selon la v\xE9locit\xE9", "Altueraren intentsitatea indarraren arabera", "\u0413\u043B\u0443\u0431\u0438\u043D\u0430 \u0432\u044B\u0441\u043E\u0442\u044B \u043E\u0442 \u0441\u0438\u043B\u044B \u043D\u0430\u0436\u0430\u0442\u0438\u044F", "\u30D4\u30C3\u30C1EG\u30A4\u30F3\u30C6\u30F3\u30B7\u30C6\u30A3(\u30D9\u30ED\u30B7\u30C6\u30A3)", "\uBCA8\uB85C\uC2DC\uD2F0\uC5D0 \uB530\uB978 \uD53C\uCE58 EG \uAC15\uB3C4", "\u529B\u5EA6\u63A7\u5236\u97F3\u9AD8\u5305\u7EDC\u5F3A\u5EA6", "\u0E04\u0E27\u0E32\u0E21\u0E40\u0E02\u0E49\u0E21\u0E1E\u0E34\u0E17\u0E0A\u0E4C\u0E15\u0E32\u0E21\u0E04\u0E27\u0E32\u0E21\u0E41\u0E23\u0E07"],
  "Tiempos de la altura por intensidad": ["Pitch EG time by velocity", "Tempos da altura pela intensidade", "Temps de la hauteur selon la v\xE9locit\xE9", "Altueraren denborak indarraren arabera", "\u0412\u0440\u0435\u043C\u044F \u0432\u044B\u0441\u043E\u0442\u044B \u043E\u0442 \u0441\u0438\u043B\u044B \u043D\u0430\u0436\u0430\u0442\u0438\u044F", "\u30D4\u30C3\u30C1EG\u30BF\u30A4\u30E0(\u30D9\u30ED\u30B7\u30C6\u30A3)", "\uBCA8\uB85C\uC2DC\uD2F0\uC5D0 \uB530\uB978 \uD53C\uCE58 EG \uD0C0\uC784", "\u529B\u5EA6\u63A7\u5236\u97F3\u9AD8\u5305\u7EDC\u65F6\u95F4", "\u0E40\u0E27\u0E25\u0E32\u0E40\u0E2D\u0E19\u0E40\u0E27\u0E42\u0E25\u0E1B\u0E1E\u0E34\u0E17\u0E0A\u0E4C\u0E15\u0E32\u0E21\u0E04\u0E27\u0E32\u0E21\u0E41\u0E23\u0E07"],
  "Ataque general": ["Global attack", "Ataque geral", "Attaque g\xE9n\xE9rale", "Eraso orokorra", "\u041E\u0431\u0449\u0430\u044F \u0430\u0442\u0430\u043A\u0430", "\u5168\u4F53\u30A2\u30BF\u30C3\u30AF", "\uC804\uCCB4 \uC5B4\uD0DD", "\u603B\u8D77\u97F3", "\u0E41\u0E2D\u0E17\u0E41\u0E17\u0E04\u0E23\u0E27\u0E21"],
  "Decaimiento general": ["Global decay", "Decaimento geral", "D\xE9clin g\xE9n\xE9ral", "Beherakada orokorra", "\u041E\u0431\u0449\u0438\u0439 \u0441\u043F\u0430\u0434", "\u5168\u4F53\u30C7\u30A3\u30B1\u30A4", "\uC804\uCCB4 \uB514\uCF00\uC774", "\u603B\u8870\u51CF", "\u0E14\u0E35\u0E40\u0E04\u0E22\u0E4C\u0E23\u0E27\u0E21"],
  "Soltado general": ["Global release", "Libera\xE7\xE3o geral", "Rel\xE2chement g\xE9n\xE9ral", "Askatze orokorra", "\u041E\u0431\u0449\u0435\u0435 \u0437\u0430\u0442\u0443\u0445\u0430\u043D\u0438\u0435", "\u5168\u4F53\u30EA\u30EA\u30FC\u30B9", "\uC804\uCCB4 \uB9B4\uB9AC\uC2A4", "\u603B\u91CA\u653E", "\u0E23\u0E35\u0E25\u0E35\u0E2A\u0E23\u0E27\u0E21"],
  "Intensidad en los tiempos del volumen": ["Velocity on amp EG times", "Intensidade nos tempos do volume", "V\xE9locit\xE9 sur les temps du volume", "Indarra bolumenaren denboretan", "\u0421\u0438\u043B\u0430 \u043D\u0430\u0436\u0430\u0442\u0438\u044F \u043D\u0430 \u0432\u0440\u0435\u043C\u044F \u0433\u0440\u043E\u043C\u043A\u043E\u0441\u0442\u0438", "\u30A2\u30F3\u30D7EG\u30BF\u30A4\u30E0\u3078\u306E\u30D9\u30ED\u30B7\u30C6\u30A3", "\uC570\uD504 EG \uD0C0\uC784\uC5D0 \uB300\uD55C \uBCA8\uB85C\uC2DC\uD2F0", "\u529B\u5EA6\u5BF9\u97F3\u91CF\u5305\u7EDC\u65F6\u95F4", "\u0E04\u0E27\u0E32\u0E21\u0E41\u0E23\u0E07\u0E15\u0E48\u0E2D\u0E40\u0E27\u0E25\u0E32\u0E40\u0E2D\u0E19\u0E40\u0E27\u0E42\u0E25\u0E1B\u0E40\u0E2A\u0E35\u0E22\u0E07"],
  "Tecla en los tiempos del volumen": ["Key on amp EG times", "Tecla nos tempos do volume", "Touche sur les temps du volume", "Tekla bolumenaren denboretan", "\u041A\u043B\u0430\u0432\u0438\u0448\u0430 \u043D\u0430 \u0432\u0440\u0435\u043C\u044F \u0433\u0440\u043E\u043C\u043A\u043E\u0441\u0442\u0438", "\u30A2\u30F3\u30D7EG\u30BF\u30A4\u30E0\u3078\u306E\u30AD\u30FC", "\uC570\uD504 EG \uD0C0\uC784\uC5D0 \uB300\uD55C \uAC74\uBC18", "\u7434\u952E\u5BF9\u97F3\u91CF\u5305\u7EDC\u65F6\u95F4", "\u0E04\u0E35\u0E22\u0E4C\u0E15\u0E48\u0E2D\u0E40\u0E27\u0E25\u0E32\u0E40\u0E2D\u0E19\u0E40\u0E27\u0E42\u0E25\u0E1B\u0E40\u0E2A\u0E35\u0E22\u0E07"],
  "Intensidad en los tiempos del filtro": ["Velocity on filter EG times", "Intensidade nos tempos do filtro", "V\xE9locit\xE9 sur les temps du filtre", "Indarra iragazkiaren denboretan", "\u0421\u0438\u043B\u0430 \u043D\u0430\u0436\u0430\u0442\u0438\u044F \u043D\u0430 \u0432\u0440\u0435\u043C\u044F \u0444\u0438\u043B\u044C\u0442\u0440\u0430", "\u30D5\u30A3\u30EB\u30BF\u30FCEG\u30BF\u30A4\u30E0\u3078\u306E\u30D9\u30ED\u30B7\u30C6\u30A3", "\uD544\uD130 EG \uD0C0\uC784\uC5D0 \uB300\uD55C \uBCA8\uB85C\uC2DC\uD2F0", "\u529B\u5EA6\u5BF9\u6EE4\u6CE2\u5668\u5305\u7EDC\u65F6\u95F4", "\u0E04\u0E27\u0E32\u0E21\u0E41\u0E23\u0E07\u0E15\u0E48\u0E2D\u0E40\u0E27\u0E25\u0E32\u0E40\u0E2D\u0E19\u0E40\u0E27\u0E42\u0E25\u0E1B\u0E1F\u0E34\u0E25\u0E40\u0E15\u0E2D\u0E23\u0E4C"],
  "Tecla en los tiempos del filtro": ["Key on filter EG times", "Tecla nos tempos do filtro", "Touche sur les temps du filtre", "Tekla iragazkiaren denboretan", "\u041A\u043B\u0430\u0432\u0438\u0448\u0430 \u043D\u0430 \u0432\u0440\u0435\u043C\u044F \u0444\u0438\u043B\u044C\u0442\u0440\u0430", "\u30D5\u30A3\u30EB\u30BF\u30FCEG\u30BF\u30A4\u30E0\u3078\u306E\u30AD\u30FC", "\uD544\uD130 EG \uD0C0\uC784\uC5D0 \uB300\uD55C \uAC74\uBC18", "\u7434\u952E\u5BF9\u6EE4\u6CE2\u5668\u5305\u7EDC\u65F6\u95F4", "\u0E04\u0E35\u0E22\u0E4C\u0E15\u0E48\u0E2D\u0E40\u0E27\u0E25\u0E32\u0E40\u0E2D\u0E19\u0E40\u0E27\u0E42\u0E25\u0E1B\u0E1F\u0E34\u0E25\u0E40\u0E15\u0E2D\u0E23\u0E4C"],
  A: ["A", "A", "A", "A", "A", "A", "A", "A", "A"],
  D: ["D", "D", "D", "D", "D", "D", "D", "D", "D"],
  S: ["S", "S", "S", "S", "S", "S", "S", "S", "S"],
  R: ["R", "R", "R", "R", "R", "R", "R", "R", "R"],
  x: ["x", "x", "x", "x", "x", "x", "x", "x", "x"],
  Inicio: ["Start", "In\xEDcio", "D\xE9but", "Hasiera", "\u041D\u0430\u0447\u0430\u043B\u043E", "\u30B9\u30BF\u30FC\u30C8", "\uC2DC\uC791", "\u8D77\u59CB", "\u0E40\u0E23\u0E34\u0E48\u0E21\u0E15\u0E49\u0E19"],
  Cima: ["Peak", "Pico", "Sommet", "Gailurra", "\u041F\u0438\u043A", "\u30D4\u30FC\u30AF", "\uD53C\uD06C", "\u5CF0\u503C", "\u0E08\u0E38\u0E14\u0E2A\u0E39\u0E07\u0E2A\u0E38\u0E14"],
  Final: ["End", "Final", "Fin", "Amaiera", "\u041A\u043E\u043D\u0435\u0446", "\u30A8\u30F3\u30C9", "\uB05D", "\u7ED3\u675F", "\u0E2A\u0E38\u0E14\u0E17\u0E49\u0E32\u0E22"],
  "F\xE1cil": ["Easy", "F\xE1cil", "Facile", "Erraza", "\u041F\u0440\u043E\u0441\u0442\u043E", "\u30A4\u30FC\u30B8\u30FC", "\uAC04\uD3B8", "\u7B80\u6613", "\u0E07\u0E48\u0E32\u0E22"],
  Control: ["Control", "Controle", "Contr\xF4le", "Kontrola", "\u0423\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435", "\u30B3\u30F3\u30C8\u30ED\u30FC\u30EB", "\uCEE8\uD2B8\uB864", "\u63A7\u5236", "\u0E04\u0E27\u0E1A\u0E04\u0E38\u0E21"],
  Efectos: ["Effects", "Efeitos", "Effets", "Efektuak", "\u042D\u0444\u0444\u0435\u043A\u0442\u044B", "\u30A8\u30D5\u30A7\u30AF\u30C8", "\uC774\uD399\uD2B8", "\u6548\u679C", "\u0E40\u0E2D\u0E1F\u0E40\u0E1F\u0E01\u0E15\u0E4C"],
  Soplo: ["Breath", "Sopro", "Souffle", "Putza", "\u0414\u044B\u0445\u0430\u043D\u0438\u0435", "\u30D6\u30EC\u30B9", "\uBE0C\uB808\uC2A4", "\u5439\u594F", "\u0E25\u0E21\u0E40\u0E1B\u0E48\u0E32"],
  "Para una capa con la fuente \xABSoplo\xBB: el modelo del tubo y c\xF3mo se toca. La envolvente de Volumen es el soplo.": ["For a layer whose source is \u201CBreath\u201D: the tube model and how it is played. The Amp envelope is the breath.", "Para uma camada com a fonte \xABSopro\xBB: o modelo do tubo e como se toca. O envelope de Volume \xE9 o sopro.", "Pour une couche dont la source est \xAB Souffle \xBB : le mod\xE8le du tube et la fa\xE7on de jouer. L\u2019enveloppe de Volume est le souffle.", "\xABPutza\xBB iturria duen geruza baterako: hodiaren eredua eta nola jotzen den. Bolumenaren inguratzailea putza da.", "\u0414\u043B\u044F \u0441\u043B\u043E\u044F \u0441 \u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A\u043E\u043C \xAB\u0414\u044B\u0445\u0430\u043D\u0438\u0435\xBB: \u043C\u043E\u0434\u0435\u043B\u044C \u0442\u0440\u0443\u0431\u044B \u0438 \u0441\u043F\u043E\u0441\u043E\u0431 \u0438\u0433\u0440\u044B. \u041E\u0433\u0438\u0431\u0430\u044E\u0449\u0430\u044F \u0433\u0440\u043E\u043C\u043A\u043E\u0441\u0442\u0438 \u2014 \u044D\u0442\u043E \u0434\u044B\u0445\u0430\u043D\u0438\u0435.", "\u30BD\u30FC\u30B9\u304C\u300C\u30D6\u30EC\u30B9\u300D\u306E\u30EC\u30A4\u30E4\u30FC\u7528:\u7BA1\u306E\u30E2\u30C7\u30EB\u3068\u594F\u6CD5\u3002\u30A2\u30F3\u30D7\u306E\u30A8\u30F3\u30D9\u30ED\u30FC\u30D7\u304C\u606F\u306B\u306A\u308A\u307E\u3059\u3002", "\uC18C\uC2A4\uAC00 \xAB\uBE0C\uB808\uC2A4\xBB\uC778 \uB808\uC774\uC5B4\uC6A9: \uAD00 \uBAA8\uB378\uACFC \uC5F0\uC8FC \uBC29\uC2DD. \uC570\uD504 \uC5D4\uBC8C\uB85C\uD504\uAC00 \uC228\uC785\uB2C8\uB2E4.", "\u7528\u4E8E\u6765\u6E90\u4E3A\u201C\u5439\u594F\u201D\u7684\u5C42\uFF1A\u7BA1\u7684\u6A21\u578B\u4E0E\u6F14\u594F\u65B9\u5F0F\u3002\u97F3\u91CF\u5305\u7EDC\u5373\u4E3A\u6C14\u606F\u3002", "\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E40\u0E25\u0E40\u0E22\u0E2D\u0E23\u0E4C\u0E17\u0E35\u0E48\u0E21\u0E35\u0E41\u0E2B\u0E25\u0E48\u0E07\u0E40\u0E2A\u0E35\u0E22\u0E07 \xAB\u0E25\u0E21\u0E40\u0E1B\u0E48\u0E32\xBB: \u0E41\u0E1A\u0E1A\u0E08\u0E33\u0E25\u0E2D\u0E07\u0E17\u0E48\u0E2D\u0E41\u0E25\u0E30\u0E27\u0E34\u0E18\u0E35\u0E40\u0E25\u0E48\u0E19 \u0E40\u0E2D\u0E19\u0E40\u0E27\u0E42\u0E25\u0E1B\u0E23\u0E30\u0E14\u0E31\u0E1A\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E04\u0E37\u0E2D\u0E25\u0E21\u0E40\u0E1B\u0E48\u0E32"],
  Tubo: ["Tube", "Tubo", "Tube", "Hodia", "\u0422\u0440\u0443\u0431\u0430", "\u7BA1", "\uAD00", "\u7BA1", "\u0E17\u0E48\u0E2D"],
  "Interpretaci\xF3n": ["Playing", "Interpreta\xE7\xE3o", "Jeu", "Interpretazioa", "\u0418\u0441\u043F\u043E\u043B\u043D\u0435\u043D\u0438\u0435", "\u594F\u6CD5", "\uC5F0\uC8FC", "\u6F14\u594F", "\u0E01\u0E32\u0E23\u0E40\u0E25\u0E48\u0E19"],
  "Realce de arm\xF3nicos": ["Harmonic enhancer", "Realce de harm\xF4nicos", "Rehausseur d\u2019harmoniques", "Harmonikoen indartzailea", "\u0423\u0441\u0438\u043B\u0438\u0442\u0435\u043B\u044C \u0433\u0430\u0440\u043C\u043E\u043D\u0438\u043A", "\u30CF\u30FC\u30E2\u30CB\u30C3\u30AF\u30FB\u30A8\u30F3\u30CF\u30F3\u30B5\u30FC", "\uD558\uBAA8\uB2C9 \uC778\uD578\uC11C", "\u8C10\u6CE2\u589E\u5F3A", "\u0E15\u0E31\u0E27\u0E40\u0E2A\u0E23\u0E34\u0E21\u0E2E\u0E32\u0E23\u0E4C\u0E21\u0E2D\u0E19\u0E34\u0E01"],
  Resonador: ["Resonator", "Ressonador", "R\xE9sonateur", "Erresonadorea", "\u0420\u0435\u0437\u043E\u043D\u0430\u0442\u043E\u0440", "\u30EC\u30BE\u30CD\u30FC\u30BF\u30FC", "\uB808\uC870\uB124\uC774\uD130", "\u5171\u9E23\u5668", "\u0E15\u0E31\u0E27\u0E2A\u0E31\u0E48\u0E19\u0E1E\u0E49\u0E2D\u0E07"],
  Cuerpo: ["Body", "Corpo", "Corps", "Gorputza", "\u041A\u043E\u0440\u043F\u0443\u0441", "\u30DC\u30C7\u30A3", "\uBC14\uB514", "\u7434\u4F53", "\u0E1A\u0E2D\u0E14\u0E35\u0E49"],
  Modelo: ["Model", "Modelo", "Mod\xE8le", "Eredua", "\u041C\u043E\u0434\u0435\u043B\u044C", "\u30E2\u30C7\u30EB", "\uBAA8\uB378", "\u6A21\u578B", "\u0E41\u0E1A\u0E1A\u0E08\u0E33\u0E25\u0E2D\u0E07"],
  "Extremo del tubo": ["Tube end", "Extremidade do tubo", "Extr\xE9mit\xE9 du tube", "Hodiaren muturra", "\u041A\u043E\u043D\u0435\u0446 \u0442\u0440\u0443\u0431\u044B", "\u7BA1\u306E\u7D42\u7AEF", "\uAD00 \uB05D", "\u7BA1\u7AEF", "\u0E1B\u0E25\u0E32\u0E22\u0E17\u0E48\u0E2D"],
  "Tubo de la ca\xF1a": ["Reed bore", "Tubo da palheta", "Perce de l\u2019anche", "Lingetaren hodia", "\u041A\u0430\u043D\u0430\u043B \u0442\u0440\u043E\u0441\u0442\u0438", "\u30EA\u30FC\u30C9\u306E\u7BA1", "\uB9AC\uB4DC \uAD00", "\u7C27\u7247\u7BA1\u4F53", "\u0E17\u0E48\u0E2D\u0E02\u0E2D\u0E07\u0E25\u0E34\u0E49\u0E19"],
  "Largo del tubo": ["Tube length", "Comprimento do tubo", "Longueur du tube", "Hodiaren luzera", "\u0414\u043B\u0438\u043D\u0430 \u0442\u0440\u0443\u0431\u044B", "\u7BA1\u306E\u9577\u3055", "\uAD00 \uAE38\uC774", "\u7BA1\u957F", "\u0E04\u0E27\u0E32\u0E21\u0E22\u0E32\u0E27\u0E17\u0E48\u0E2D"],
  "Nota del tubo": ["Tube note", "Nota do tubo", "Note du tube", "Hodiaren nota", "\u041D\u043E\u0442\u0430 \u0442\u0440\u0443\u0431\u044B", "\u7BA1\u306E\u97F3", "\uAD00 \uC74C", "\u7BA1\u7684\u97F3", "\u0E42\u0E19\u0E49\u0E15\u0E02\u0E2D\u0E07\u0E17\u0E48\u0E2D"],
  "Afinaci\xF3n del tubo": ["Tube tuning", "Afina\xE7\xE3o do tubo", "Accord du tube", "Hodiaren afinazioa", "\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430 \u0442\u0440\u0443\u0431\u044B", "\u7BA1\u306E\u30C1\u30E5\u30FC\u30CB\u30F3\u30B0", "\uAD00 \uD29C\uB2DD", "\u7BA1\u7684\u8C03\u97F3", "\u0E01\u0E32\u0E23\u0E08\u0E39\u0E19\u0E17\u0E48\u0E2D"],
  "Desv\xEDo de la nota": ["Note bend", "Desvio da nota", "Inflexion de la note", "Notaren desbideratzea", "\u041E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u0438\u0435 \u043D\u043E\u0442\u044B", "\u30CE\u30FC\u30C8\u306E\u30D9\u30F3\u30C9", "\uC74C \uBCA4\uB4DC", "\u97F3\u9AD8\u5F2F\u66F2", "\u0E01\u0E32\u0E23\u0E40\u0E1A\u0E19\u0E42\u0E19\u0E49\u0E15"],
  "Desv\xEDo al sostener": ["Bend while held", "Desvio ao sustentar", "Inflexion en tenue", "Desbideratzea eustean", "\u041E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u0438\u0435 \u043F\u0440\u0438 \u0443\u0434\u0435\u0440\u0436\u0430\u043D\u0438\u0438", "\u4FDD\u6301\u4E2D\u306E\u30D9\u30F3\u30C9", "\uC720\uC9C0 \uC911 \uBCA4\uB4DC", "\u4FDD\u6301\u65F6\u5F2F\u97F3", "\u0E40\u0E1A\u0E19\u0E02\u0E13\u0E30\u0E04\u0E49\u0E32\u0E07\u0E42\u0E19\u0E49\u0E15"],
  Desv\u00EDo: ["Bend", "Desvio", "Inflexion", "Desbideratzea", "\u041E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u0438\u0435", "\u30D9\u30F3\u30C9", "\uBCA4\uB4DC", "\u5F2F\u97F3", "\u0E01\u0E32\u0E23\u0E40\u0E1A\u0E19"],
  "Tiempo del desv\xEDo": ["Bend time", "Tempo do desvio", "Temps de l\u2019inflexion", "Desbideratzearen denbora", "\u0412\u0440\u0435\u043C\u044F \u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u0438\u044F", "\u30D9\u30F3\u30C9\u306E\u30BF\u30A4\u30E0", "\uBCA4\uB4DC \uD0C0\uC784", "\u5F2F\u97F3\u65F6\u95F4", "\u0E40\u0E27\u0E25\u0E32\u0E01\u0E32\u0E23\u0E40\u0E1A\u0E19"],
  "Desv\xEDo al final": ["Bend at the end", "Desvio no final", "Inflexion \xE0 la fin", "Desbideratzea amaieran", "\u041E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u0438\u0435 \u0432 \u043A\u043E\u043D\u0446\u0435", "\u7D42\u308F\u308A\u306E\u30D9\u30F3\u30C9", "\uB05D \uBCA4\uB4DC", "\u7ED3\u5C3E\u5F2F\u97F3", "\u0E40\u0E1A\u0E19\u0E15\u0E2D\u0E19\u0E17\u0E49\u0E32\u0E22"],
  "Al final": ["At the end", "No final", "\xC0 la fin", "Amaieran", "\u0412 \u043A\u043E\u043D\u0446\u0435", "\u7D42\u308F\u308A", "\uB05D", "\u7ED3\u5C3E", "\u0E15\u0E2D\u0E19\u0E17\u0E49\u0E32\u0E22"],
  Inestabilidad: ["Instability", "Instabilidade", "Instabilit\xE9", "Ezegonkortasuna", "\u041D\u0435\u0441\u0442\u0430\u0431\u0438\u043B\u044C\u043D\u043E\u0441\u0442\u044C", "\u4E0D\u5B89\u5B9A\u3055", "\uBD88\uC548\uC815\uC131", "\u4E0D\u7A33\u5B9A\u5EA6", "\u0E04\u0E27\u0E32\u0E21\u0E44\u0E21\u0E48\u0E19\u0E34\u0E48\u0E07"],
  "Velocidad de la inestabilidad": ["Instability rate", "Velocidade da instabilidade", "Vitesse de l\u2019instabilit\xE9", "Ezegonkortasunaren abiadura", "\u0421\u043A\u043E\u0440\u043E\u0441\u0442\u044C \u043D\u0435\u0441\u0442\u0430\u0431\u0438\u043B\u044C\u043D\u043E\u0441\u0442\u0438", "\u4E0D\u5B89\u5B9A\u3055\u306E\u901F\u3055", "\uBD88\uC548\uC815 \uC18D\uB3C4", "\u4E0D\u7A33\u5B9A\u901F\u5EA6", "\u0E04\u0E27\u0E32\u0E21\u0E40\u0E23\u0E47\u0E27\u0E02\u0E2D\u0E07\u0E04\u0E27\u0E32\u0E21\u0E44\u0E21\u0E48\u0E19\u0E34\u0E48\u0E07"],
  "Tercer parcial": ["Third partial", "Terceiro parcial", "Troisi\xE8me partiel", "Hirugarren partziala", "\u0422\u0440\u0435\u0442\u0438\u0439 \u043E\u0431\u0435\u0440\u0442\u043E\u043D", "\u7B2C3\u500D\u97F3", "\uC81C3 \uBC30\uC74C", "\u7B2C\u4E09\u5206\u97F3", "\u0E42\u0E2D\u0E40\u0E27\u0E2D\u0E23\u0E4C\u0E42\u0E17\u0E19\u0E17\u0E35\u0E48\u0E2A\u0E32\u0E21"],
  Tercero: ["Third", "Terceiro", "Troisi\xE8me", "Hirugarrena", "\u0422\u0440\u0435\u0442\u0438\u0439", "\u7B2C3", "\uC81C3", "\u7B2C\u4E09", "\u0E17\u0E35\u0E48\u0E2A\u0E32\u0E21"],
  "Medidas del tubo": ["Tube measurements", "Medidas do tubo", "Mesures du tube", "Hodiaren neurriak", "\u0420\u0430\u0437\u043C\u0435\u0440\u044B \u0442\u0440\u0443\u0431\u044B", "\u7BA1\u306E\u5BF8\u6CD5", "\uAD00 \uCE58\uC218", "\u7BA1\u7684\u5C3A\u5BF8", "\u0E02\u0E19\u0E32\u0E14\u0E02\u0E2D\u0E07\u0E17\u0E48\u0E2D"],
  "Forma del tubo": ["Tube shape", "Forma do tubo", "Forme du tube", "Hodiaren forma", "\u0424\u043E\u0440\u043C\u0430 \u0442\u0440\u0443\u0431\u044B", "\u7BA1\u306E\u5F62", "\uAD00 \uBAA8\uC591", "\u7BA1\u7684\u5F62\u72B6", "\u0E23\u0E39\u0E1B\u0E17\u0E23\u0E07\u0E17\u0E48\u0E2D"],
  Simple: ["Simple", "Simples", "Simple", "Sinplea", "\u041F\u0440\u043E\u0441\u0442\u0430\u044F", "\u30B7\u30F3\u30D7\u30EB", "\uB2E8\uC21C", "\u7B80\u5355", "\u0E41\u0E1A\u0E1A\u0E07\u0E48\u0E32\u0E22"],
  "Con medidas": ["Measured", "Com medidas", "Avec mesures", "Neurriekin", "\u041F\u043E \u0440\u0430\u0437\u043C\u0435\u0440\u0430\u043C", "\u5BF8\u6CD5\u3042\u308A", "\uCE58\uC218 \uC9C0\uC815", "\u6309\u5C3A\u5BF8", "\u0E15\u0E32\u0E21\u0E02\u0E19\u0E32\u0E14"],
  "Largo desde": ["Length from", "Comprimento a partir de", "Longueur selon", "Luzera nondik", "\u0414\u043B\u0438\u043D\u0430 \u043F\u043E", "\u9577\u3055\u306E\u57FA\u6E96", "\uAE38\uC774 \uAE30\uC900", "\u957F\u5EA6\u4F9D\u636E", "\u0E04\u0E27\u0E32\u0E21\u0E22\u0E32\u0E27\u0E08\u0E32\u0E01"],
  "La nota": ["The note", "A nota", "La note", "Nota", "\u041D\u043E\u0442\u0435", "\u97F3", "\uC74C", "\u97F3\u9AD8", "\u0E42\u0E19\u0E49\u0E15"],
  "El largo": ["The length", "O comprimento", "La longueur", "Luzera", "\u0414\u043B\u0438\u043D\u0435", "\u9577\u3055", "\uAE38\uC774", "\u957F\u5EA6", "\u0E04\u0E27\u0E32\u0E21\u0E22\u0E32\u0E27"],
  "Largo del tubo recto": ["Straight tube length", "Comprimento do tubo reto", "Longueur du tube droit", "Hodi zuzenaren luzera", "\u0414\u043B\u0438\u043D\u0430 \u043F\u0440\u044F\u043C\u043E\u0439 \u0442\u0440\u0443\u0431\u044B", "\u76F4\u7BA1\u306E\u9577\u3055", "\uC9C1\uAD00 \uAE38\uC774", "\u76F4\u7BA1\u957F\u5EA6", "\u0E04\u0E27\u0E32\u0E21\u0E22\u0E32\u0E27\u0E17\u0E48\u0E2D\u0E15\u0E23\u0E07"],
  "Di\xE1metro del tubo": ["Tube diameter", "Di\xE2metro do tubo", "Diam\xE8tre du tube", "Hodiaren diametroa", "\u0414\u0438\u0430\u043C\u0435\u0442\u0440 \u0442\u0440\u0443\u0431\u044B", "\u7BA1\u306E\u76F4\u5F84", "\uAD00 \uC9C0\uB984", "\u7BA1\u7684\u76F4\u5F84", "\u0E40\u0E2A\u0E49\u0E19\u0E1C\u0E48\u0E32\u0E19\u0E28\u0E39\u0E19\u0E22\u0E4C\u0E01\u0E25\u0E32\u0E07\u0E17\u0E48\u0E2D"],
  Di\u00E1metro: ["Diameter", "Di\xE2metro", "Diam\xE8tre", "Diametroa", "\u0414\u0438\u0430\u043C\u0435\u0442\u0440", "\u76F4\u5F84", "\uC9C0\uB984", "\u76F4\u5F84", "\u0E40\u0E2A\u0E49\u0E19\u0E1C\u0E48\u0E32\u0E19\u0E28\u0E39\u0E19\u0E22\u0E4C\u0E01\u0E25\u0E32\u0E07"],
  "Largo del cacho": ["Horn length", "Comprimento do chifre", "Longueur de la corne", "Adarraren luzera", "\u0414\u043B\u0438\u043D\u0430 \u0440\u043E\u0433\u0430", "\u89D2\u306E\u9577\u3055", "\uBFD4 \uAE38\uC774", "\u725B\u89D2\u957F\u5EA6", "\u0E04\u0E27\u0E32\u0E21\u0E22\u0E32\u0E27\u0E40\u0E02\u0E32"],
  "Boca del cacho": ["Horn mouth", "Boca do chifre", "Pavillon de la corne", "Adarraren ahoa", "\u0420\u0430\u0441\u0442\u0440\u0443\u0431 \u0440\u043E\u0433\u0430", "\u89D2\u306E\u53E3", "\uBFD4 \uC785\uAD6C", "\u725B\u89D2\u53E3\u5F84", "\u0E1B\u0E32\u0E01\u0E40\u0E02\u0E32"],
  "Curva del cacho": ["Horn flare", "Curva do chifre", "\xC9vasement de la corne", "Adarraren kurba", "\u0418\u0437\u0433\u0438\u0431 \u0440\u043E\u0433\u0430", "\u89D2\u306E\u5E83\u304C\u308A", "\uBFD4 \uBC8C\uC5B4\uC9D0", "\u725B\u89D2\u5F27\u5EA6", "\u0E04\u0E27\u0E32\u0E21\u0E1A\u0E32\u0E19\u0E02\u0E2D\u0E07\u0E40\u0E02\u0E32"],
  Curva: ["Flare", "Curva", "\xC9vasement", "Kurba", "\u0418\u0437\u0433\u0438\u0431", "\u5E83\u304C\u308A", "\uBC8C\uC5B4\uC9D0", "\u5F27\u5EA6", "\u0E04\u0E27\u0E32\u0E21\u0E1A\u0E32\u0E19"],
  Enrollado: ["Coiling", "Enrolado", "Enroulement", "Bilduta", "\u0421\u0432\u0451\u0440\u043D\u0443\u0442\u043E\u0441\u0442\u044C", "\u5DFB\u304D", "\uAC10\uAE40", "\u76D8\u7ED5", "\u0E01\u0E32\u0E23\u0E02\u0E14"],
  Espiral: ["Spiral", "Espiral", "Spirale", "Espirala", "\u0421\u043F\u0438\u0440\u0430\u043B\u044C", "\u6E26\u5DFB\u304D", "\uB098\uC120", "\u87BA\u65CB", "\u0E40\u0E01\u0E25\u0E35\u0E22\u0E27"],
  \u00D3valo: ["Oval", "Oval", "Ovale", "Obalua", "\u041E\u0432\u0430\u043B", "\u6955\u5186", "\uD0C0\uC6D0", "\u692D\u5706", "\u0E27\u0E07\u0E23\u0E35"],
  Vueltas: ["Turns", "Voltas", "Tours", "Birak", "\u0412\u0438\u0442\u043A\u0438", "\u5DFB\u304D\u6570", "\uAC10\uC740 \uC218", "\u5708\u6570", "\u0E08\u0E33\u0E19\u0E27\u0E19\u0E23\u0E2D\u0E1A"],
  "Sentido del aire": ["Air direction", "Sentido do ar", "Sens de l\u2019air", "Airearen norabidea", "\u041D\u0430\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u0432\u043E\u0437\u0434\u0443\u0445\u0430", "\u606F\u306E\u5411\u304D", "\uACF5\uAE30 \uBC29\uD5A5", "\u6C14\u6D41\u65B9\u5411", "\u0E17\u0E34\u0E28\u0E17\u0E32\u0E07\u0E25\u0E21"],
  Soplado: ["Blown", "Soprado", "Souffl\xE9", "Putz eginda", "\u0412\u044B\u0434\u043E\u0445", "\u5439\u304F", "\uBD88\uAE30", "\u5439\u6C14", "\u0E40\u0E1B\u0E48\u0E32"],
  Aspirado: ["Inhaled", "Aspirado", "Aspir\xE9", "Arnasa hartuta", "\u0412\u0434\u043E\u0445", "\u5438\u3046", "\uB4E4\uC774\uC26C\uAE30", "\u5438\u6C14", "\u0E2A\u0E39\u0E14"],
  Cacho: ["Horn", "Chifre", "Corne", "Adarra", "\u0420\u043E\u0433", "\u89D2", "\uBFD4", "\u725B\u89D2", "\u0E40\u0E02\u0E32"],
  "Materiales:": ["Materials:", "Materiais:", "Mat\xE9riaux :", "Materialak:", "\u041C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u044B:", "\u7D20\u6750:", "\uC7AC\uB8CC:", "\u6750\u6599\uFF1A", "\u0E27\u0E31\u0E2A\u0E14\u0E38:"],
  "Ca\xF1er\xEDa de gas": ["Gas pipe", "Cano de g\xE1s", "Tuyau de gaz", "Gas-hodia", "\u0413\u0430\u0437\u043E\u0432\u0430\u044F \u0442\u0440\u0443\u0431\u0430", "\u30AC\u30B9\u7BA1", "\uAC00\uC2A4\uAD00", "\u71C3\u6C14\u7BA1", "\u0E17\u0E48\u0E2D\u0E41\u0E01\u0E4A\u0E2A"],
  "Ca\xF1er\xEDa de agua": ["Water pipe", "Cano de \xE1gua", "Tuyau d\u2019eau", "Ur-hodia", "\u0412\u043E\u0434\u043E\u043F\u0440\u043E\u0432\u043E\u0434\u043D\u0430\u044F \u0442\u0440\u0443\u0431\u0430", "\u6C34\u9053\u7BA1", "\uC218\uB3C4\uAD00", "\u6C34\u7BA1", "\u0E17\u0E48\u0E2D\u0E1B\u0E23\u0E30\u0E1B\u0E32"],
  "Cacho de cabra": ["Goat horn", "Chifre de cabra", "Corne de ch\xE8vre", "Ahuntz-adarra", "\u041A\u043E\u0437\u0438\u0439 \u0440\u043E\u0433", "\u30E4\u30AE\u306E\u89D2", "\uC5FC\uC18C \uBFD4", "\u5C71\u7F8A\u89D2", "\u0E40\u0E02\u0E32\u0E41\u0E1E\u0E30"],
  "Cacho de vaca": ["Cow horn", "Chifre de vaca", "Corne de vache", "Behi-adarra", "\u041A\u043E\u0440\u043E\u0432\u0438\u0439 \u0440\u043E\u0433", "\u725B\u306E\u89D2", "\uC18C\uBFD4", "\u725B\u89D2", "\u0E40\u0E02\u0E32\u0E27\u0E31\u0E27"],
  "Tallo de \xF1olki\xF1": ["\xD1olki\xF1 stalk", "Talo de \xF1olki\xF1", "Tige de \xF1olki\xF1", "\xD1olki\xF1 zurtoina", "\u0421\u0442\u0435\u0431\u0435\u043B\u044C \u043D\u044C\u043E\u043B\u044C\u043A\u0438\u043D\u044F", "\u30CB\u30E7\u30EB\u30AD\u30F3\u306E\u830E", "\uB1F0\uD0A8 \uC904\uAE30", "\xF1olki\xF1 \u830E", "\u0E25\u0E33\u0E15\u0E49\u0E19\u0E0D\u0E2D\u0E25\u0E01\u0E34\u0E0D"],
  "Cono de hoja": ["Leaf cone", "Cone de folha", "C\xF4ne de feuille", "Hosto-kono", "\u041A\u043E\u043D\u0443\u0441 \u0438\u0437 \u043B\u0438\u0441\u0442\u0430", "\u8449\u306E\u5186\u9310", "\uC78E \uC6D0\uBFD4", "\u53F6\u5377\u9525", "\u0E01\u0E23\u0E27\u0E22\u0E43\u0E1A\u0E44\u0E21\u0E49"],
  "Largo 1,5 m": ["Length 1.5 m", "Comprimento 1,5 m", "Longueur 1,5 m", "Luzera 1,5 m", "\u0414\u043B\u0438\u043D\u0430 1,5 \u043C", "\u9577\u3055 1.5 m", "\uAE38\uC774 1.5 m", "\u957F\u5EA6 1.5 \u7C73", "\u0E22\u0E32\u0E27 1.5 \u0E21."],
  "Largo 2 m": ["Length 2 m", "Comprimento 2 m", "Longueur 2 m", "Luzera 2 m", "\u0414\u043B\u0438\u043D\u0430 2 \u043C", "\u9577\u3055 2 m", "\uAE38\uC774 2 m", "\u957F\u5EA6 2 \u7C73", "\u0E22\u0E32\u0E27 2 \u0E21."],
  "Pared del tubo": ["Tube wall", "Parede do tubo", "Paroi du tube", "Hodiaren horma", "\u0421\u0442\u0435\u043D\u043A\u0430 \u0442\u0440\u0443\u0431\u044B", "\u7BA1\u306E\u58C1", "\uAD00 \uBCBD", "\u7BA1\u58C1", "\u0E1C\u0E19\u0E31\u0E07\u0E17\u0E48\u0E2D"],
  Pared: ["Wall", "Parede", "Paroi", "Horma", "\u0421\u0442\u0435\u043D\u043A\u0430", "\u58C1", "\uBCBD", "\u7BA1\u58C1", "\u0E1C\u0E19\u0E31\u0E07"],
  "Cacho blando": ["Soft horn", "Chifre macio", "Pavillon souple", "Adar biguna", "\u041C\u044F\u0433\u043A\u0438\u0439 \u0440\u0430\u0441\u0442\u0440\u0443\u0431", "\u67D4\u3089\u304B\u3044\u89D2", "\uBD80\uB4DC\uB7EC\uC6B4 \uBFD4", "\u8F6F\u5587\u53ED\u53E3", "\u0E1B\u0E32\u0E01\u0E41\u0E15\u0E23\u0E19\u0E38\u0E48\u0E21"],
  Blando: ["Soft", "Macio", "Souple", "Biguna", "\u041C\u044F\u0433\u043A\u043E\u0441\u0442\u044C", "\u67D4\u3089\u304B\u3055", "\uBD80\uB4DC\uB7EC\uC6C0", "\u8F6F", "\u0E19\u0E38\u0E48\u0E21"],
  Labio: ["Lip", "L\xE1bio", "L\xE8vre", "Ezpaina", "\u0413\u0443\u0431\u0430", "\u5507", "\uC785\uC220", "\u5507", "\u0E23\u0E34\u0E21\u0E1D\u0E35\u0E1B\u0E32\u0E01"],
  "Con flujo de aire": ["With airflow", "Com fluxo de ar", "Avec flux d\u2019air", "Aire-fluxuarekin", "\u0421 \u043F\u043E\u0442\u043E\u043A\u043E\u043C \u0432\u043E\u0437\u0434\u0443\u0445\u0430", "\u6C17\u6D41\u3042\u308A", "\uACF5\uAE30 \uD750\uB984", "\u5E26\u6C14\u6D41", "\u0E21\u0E35\u0E01\u0E32\u0E23\u0E44\u0E2B\u0E25\u0E02\u0E2D\u0E07\u0E25\u0E21"],
  Boquilla: ["Mouthpiece", "Bocal", "Embouchure", "Ahokoa", "\u041C\u0443\u043D\u0434\u0448\u0442\u0443\u043A", "\u30DE\u30A6\u30B9\u30D4\u30FC\u30B9", "\uB9C8\uC6B0\uC2A4\uD53C\uC2A4", "\u53F7\u5634", "\u0E1B\u0E32\u0E01\u0E40\u0E1B\u0E48\u0E32"],
  "Sin boquilla": ["No mouthpiece", "Sem bocal", "Sans embouchure", "Ahokorik gabe", "\u0411\u0435\u0437 \u043C\u0443\u043D\u0434\u0448\u0442\u0443\u043A\u0430", "\u30DE\u30A6\u30B9\u30D4\u30FC\u30B9\u306A\u3057", "\uB9C8\uC6B0\uC2A4\uD53C\uC2A4 \uC5C6\uC74C", "\u65E0\u53F7\u5634", "\u0E44\u0E21\u0E48\u0E21\u0E35\u0E1B\u0E32\u0E01\u0E40\u0E1B\u0E48\u0E32"],
  "Con boquilla": ["With mouthpiece", "Com bocal", "Avec embouchure", "Ahokoarekin", "\u0421 \u043C\u0443\u043D\u0434\u0448\u0442\u0443\u043A\u043E\u043C", "\u30DE\u30A6\u30B9\u30D4\u30FC\u30B9\u3042\u308A", "\uB9C8\uC6B0\uC2A4\uD53C\uC2A4 \uC788\uC74C", "\u6709\u53F7\u5634", "\u0E21\u0E35\u0E1B\u0E32\u0E01\u0E40\u0E1B\u0E48\u0E32"],
  "Copa de la boquilla": ["Mouthpiece cup", "Copo do bocal", "Cuvette de l\u2019embouchure", "Ahokoaren kopa", "\u0427\u0430\u0448\u043A\u0430 \u043C\u0443\u043D\u0434\u0448\u0442\u0443\u043A\u0430", "\u30DE\u30A6\u30B9\u30D4\u30FC\u30B9\u306E\u30AB\u30C3\u30D7", "\uB9C8\uC6B0\uC2A4\uD53C\uC2A4 \uCEF5", "\u53F7\u5634\u676F", "\u0E16\u0E49\u0E27\u0E22\u0E1B\u0E32\u0E01\u0E40\u0E1B\u0E48\u0E32"],
  Copa: ["Cup", "Copo", "Cuvette", "Kopa", "\u0427\u0430\u0448\u043A\u0430", "\u30AB\u30C3\u30D7", "\uCEF5", "\u676F", "\u0E16\u0E49\u0E27\u0E22"],
  "Garganta de la boquilla": ["Mouthpiece throat", "Garganta do bocal", "Grain de l\u2019embouchure", "Ahokoaren eztarria", "\u0413\u043E\u0440\u043B\u043E \u043C\u0443\u043D\u0434\u0448\u0442\u0443\u043A\u0430", "\u30DE\u30A6\u30B9\u30D4\u30FC\u30B9\u306E\u30B9\u30ED\u30FC\u30C8", "\uB9C8\uC6B0\uC2A4\uD53C\uC2A4 \uC2A4\uB85C\uD2B8", "\u53F7\u5634\u5589\u90E8", "\u0E04\u0E2D\u0E1B\u0E32\u0E01\u0E40\u0E1B\u0E48\u0E32"],
  Garganta: ["Throat", "Garganta", "Grain", "Eztarria", "\u0413\u043E\u0440\u043B\u043E", "\u30B9\u30ED\u30FC\u30C8", "\uC2A4\uB85C\uD2B8", "\u5589\u90E8", "\u0E04\u0E2D"],
  Bramido: ["Blare", "Bramido", "Cuivr\xE9", "Orroa", "\u0420\u0451\u0432", "\u30D6\u30EC\u30A2", "\uD3EC\uD6A8", "\u5486\u54EE", "\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E04\u0E33\u0E23\u0E32\u0E21"],
  Ligado: ["Legato", "Ligado", "Legato", "Lotua", "\u041B\u0435\u0433\u0430\u0442\u043E", "\u30EC\u30AC\u30FC\u30C8", "\uB808\uAC00\uD1A0", "\u8FDE\u594F", "\u0E40\u0E25\u0E01\u0E32\u0E42\u0E15"],
  No: ["No", "N\xE3o", "Non", "Ez", "\u041D\u0435\u0442", "\u3044\u3044\u3048", "\uC544\uB2C8\uC694", "\u5426", "\u0E44\u0E21\u0E48"],
  S\u00ED: ["Yes", "Sim", "Oui", "Bai", "\u0414\u0430", "\u306F\u3044", "\uC608", "\u662F", "\u0E43\u0E0A\u0E48"],
  "Tiempo del ligado": ["Legato time", "Tempo do ligado", "Temps du legato", "Lotuaren denbora", "\u0412\u0440\u0435\u043C\u044F \u043B\u0435\u0433\u0430\u0442\u043E", "\u30EC\u30AC\u30FC\u30C8\u306E\u30BF\u30A4\u30E0", "\uB808\uAC00\uD1A0 \uD0C0\uC784", "\u8FDE\u594F\u65F6\u95F4", "\u0E40\u0E27\u0E25\u0E32\u0E40\u0E25\u0E01\u0E32\u0E42\u0E15"],
  Paso: ["Glide", "Passagem", "Passage", "Pasabidea", "\u041F\u0435\u0440\u0435\u0445\u043E\u0434", "\u79FB\u884C", "\uC804\uD658", "\u8FC7\u6E21", "\u0E01\u0E32\u0E23\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19"],
  "Golpe de lengua": ["Tonguing", "Golpe de l\xEDngua", "Coup de langue", "Mihi-kolpea", "\u0410\u0442\u0430\u043A\u0430 \u044F\u0437\u044B\u043A\u043E\u043C", "\u30BF\u30F3\u30AE\u30F3\u30B0", "\uD145\uC789", "\u5410\u97F3", "\u0E01\u0E32\u0E23\u0E15\u0E31\u0E14\u0E25\u0E34\u0E49\u0E19"],
  Lengua: ["Tongue", "L\xEDngua", "Langue", "Mihia", "\u042F\u0437\u044B\u043A", "\u30BF\u30F3\u30AE\u30F3\u30B0", "\uD145\uC789", "\u5410\u97F3", "\u0E25\u0E34\u0E49\u0E19"],
  Respiraci\u00F3n: ["Breathing", "Respira\xE7\xE3o", "Respiration", "Arnasketa", "\u0414\u044B\u0445\u0430\u043D\u0438\u0435", "\u547C\u5438", "\uD638\uD761", "\u547C\u5438", "\u0E01\u0E32\u0E23\u0E2B\u0E32\u0E22\u0E43\u0E08"],
  "Variaci\xF3n entre notas": ["Note-to-note variation", "Varia\xE7\xE3o entre notas", "Variation entre les notes", "Noten arteko aldakuntza", "\u0420\u0430\u0437\u0431\u0440\u043E\u0441 \u043C\u0435\u0436\u0434\u0443 \u043D\u043E\u0442\u0430\u043C\u0438", "\u30CE\u30FC\u30C8\u3054\u3068\u306E\u3070\u3089\u3064\u304D", "\uC74C \uC0AC\uC774 \uBCC0\uD654", "\u97F3\u7B26\u95F4\u53D8\u5316", "\u0E04\u0E27\u0E32\u0E21\u0E15\u0E48\u0E32\u0E07\u0E23\u0E30\u0E2B\u0E27\u0E48\u0E32\u0E07\u0E42\u0E19\u0E49\u0E15"],
  Variaci\u00F3n: ["Variation", "Varia\xE7\xE3o", "Variation", "Aldakuntza", "\u0420\u0430\u0437\u0431\u0440\u043E\u0441", "\u3070\u3089\u3064\u304D", "\uBCC0\uD654", "\u53D8\u5316", "\u0E04\u0E27\u0E32\u0E21\u0E15\u0E48\u0E32\u0E07"],
  "Resonancia de la boca": ["Mouth resonance", "Resson\xE2ncia da boca", "R\xE9sonance de la bouche", "Ahoaren erresonantzia", "\u0420\u0435\u0437\u043E\u043D\u0430\u043D\u0441 \u0440\u0442\u0430", "\u53E3\u306E\u5171\u9CF4", "\uC785 \uACF5\uBA85", "\u53E3\u8154\u5171\u9E23", "\u0E01\u0E32\u0E23\u0E2A\u0E31\u0E48\u0E19\u0E1E\u0E49\u0E2D\u0E07\u0E02\u0E2D\u0E07\u0E1B\u0E32\u0E01"],
  Boca: ["Mouth", "Boca", "Bouche", "Ahoa", "\u0420\u043E\u0442", "\u53E3", "\uC785", "\u53E3\u8154", "\u0E1B\u0E32\u0E01"],
  "Primera resonancia de la boca": ["First mouth resonance", "Primeira resson\xE2ncia da boca", "Premi\xE8re r\xE9sonance de la bouche", "Ahoaren lehen erresonantzia", "\u041F\u0435\u0440\u0432\u044B\u0439 \u0440\u0435\u0437\u043E\u043D\u0430\u043D\u0441 \u0440\u0442\u0430", "\u53E3\u306E\u7B2C1\u5171\u9CF4", "\uC785 \uC81C1 \uACF5\uBA85", "\u53E3\u8154\u7B2C\u4E00\u5171\u9E23", "\u0E01\u0E32\u0E23\u0E2A\u0E31\u0E48\u0E19\u0E1E\u0E49\u0E2D\u0E07\u0E41\u0E23\u0E01\u0E02\u0E2D\u0E07\u0E1B\u0E32\u0E01"],
  "Boca 1": ["Mouth 1", "Boca 1", "Bouche 1", "Ahoa 1", "\u0420\u043E\u0442 1", "\u53E3 1", "\uC785 1", "\u53E3\u8154 1", "\u0E1B\u0E32\u0E01 1"],
  "Segunda resonancia de la boca": ["Second mouth resonance", "Segunda resson\xE2ncia da boca", "Deuxi\xE8me r\xE9sonance de la bouche", "Ahoaren bigarren erresonantzia", "\u0412\u0442\u043E\u0440\u043E\u0439 \u0440\u0435\u0437\u043E\u043D\u0430\u043D\u0441 \u0440\u0442\u0430", "\u53E3\u306E\u7B2C2\u5171\u9CF4", "\uC785 \uC81C2 \uACF5\uBA85", "\u53E3\u8154\u7B2C\u4E8C\u5171\u9E23", "\u0E01\u0E32\u0E23\u0E2A\u0E31\u0E48\u0E19\u0E1E\u0E49\u0E2D\u0E07\u0E17\u0E35\u0E48\u0E2A\u0E2D\u0E07\u0E02\u0E2D\u0E07\u0E1B\u0E32\u0E01"],
  "Boca 2": ["Mouth 2", "Boca 2", "Bouche 2", "Ahoa 2", "\u0420\u043E\u0442 2", "\u53E3 2", "\uC785 2", "\u53E3\u8154 2", "\u0E1B\u0E32\u0E01 2"],
  Aire: ["Air", "Ar", "Air", "Airea", "\u0412\u043E\u0437\u0434\u0443\u0445", "\u30A8\u30A2", "\uACF5\uAE30", "\u6C14", "\u0E25\u0E21"],
  Embocadura: ["Embouchure", "Embocadura", "Embouchure", "Ahokoa", "\u0410\u043C\u0431\u0443\u0448\u044E\u0440", "\u30A2\u30F3\u30D6\u30B7\u30E5\u30A2", "\uC559\uBD80\uC288\uB974", "\u53E3\u578B", "\u0E01\u0E32\u0E23\u0E27\u0E32\u0E07\u0E1B\u0E32\u0E01"],
  "Ruido de aliento": ["Breath noise", "Ru\xEDdo de sopro", "Bruit de souffle", "Arnasaren zarata", "\u0428\u0443\u043C \u0434\u044B\u0445\u0430\u043D\u0438\u044F", "\u30D6\u30EC\u30B9\u30FB\u30CE\u30A4\u30BA", "\uBE0C\uB808\uC2A4 \uB178\uC774\uC988", "\u6C14\u606F\u566A\u58F0", "\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E25\u0E21\u0E2B\u0E32\u0E22\u0E43\u0E08"],
  "Subida con el aire": ["Pitch rise with air", "Subida com o ar", "Mont\xE9e avec l\u2019air", "Igoera airearekin", "\u041F\u043E\u0434\u044A\u0451\u043C \u0441 \u0432\u043E\u0437\u0434\u0443\u0445\u043E\u043C", "\u30A8\u30A2\u306B\u3088\u308B\u30D4\u30C3\u30C1\u4E0A\u6607", "\uACF5\uAE30\uC5D0 \uB530\uB978 \uC74C \uC62C\uB9BC", "\u968F\u6C14\u606F\u5347\u9AD8", "\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E2A\u0E39\u0E07\u0E02\u0E36\u0E49\u0E19\u0E15\u0E32\u0E21\u0E25\u0E21"],
  Salto: ["Overblow", "Salto", "Saut", "Jauzia", "\u041F\u0435\u0440\u0435\u0434\u0443\u0432\u0430\u043D\u0438\u0435", "\u30AA\u30FC\u30D0\u30FC\u30D6\u30ED\u30FC", "\uC624\uBC84\uBE14\uB85C", "\u8D85\u5439", "\u0E01\u0E32\u0E23\u0E40\u0E1B\u0E48\u0E32\u0E02\u0E49\u0E32\u0E21"],
  Aspereza: ["Roughness", "Aspereza", "Rugosit\xE9", "Zakartasuna", "\u0428\u0435\u0440\u043E\u0445\u043E\u0432\u0430\u0442\u043E\u0441\u0442\u044C", "\u30E9\u30D5\u30CD\u30B9", "\uAC70\uCE60\uAE30", "\u7C97\u7CD9\u5EA6", "\u0E04\u0E27\u0E32\u0E21\u0E2B\u0E22\u0E32\u0E1A"],
  "Gru\xF1ido": ["Growl", "Rosnado", "Grognement", "Marmarra", "\u0420\u044B\u0447\u0430\u043D\u0438\u0435", "\u30B0\u30ED\u30A6\u30EB", "\uADF8\uB85C\uC6B8", "\u5486\u54EE\u97F3", "\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E04\u0E33\u0E23\u0E32\u0E21"],
  Grito: ["Scream", "Grito", "Cri", "Oihua", "\u041A\u0440\u0438\u043A", "\u30B9\u30AF\u30EA\u30FC\u30E0", "\uC2A4\uD06C\uB9BC", "\u5C16\u53EB", "\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E01\u0E23\u0E35\u0E14"],
  "Doble fondo": ["Double bore", "Fundo duplo", "Double fond", "Hondo bikoitza", "\u0414\u0432\u043E\u0439\u043D\u043E\u0435 \u0434\u043D\u043E", "\u4E8C\u91CD\u306E\u5E95", "\uC774\uC911 \uBC14\uB2E5", "\u53CC\u5E95", "\u0E01\u0E49\u0E19\u0E04\u0E39\u0E48"],
  "Entrada del fondo": ["Second bore entry", "Entrada do fundo", "Entr\xE9e du fond", "Hondoaren sarrera", "\u0412\u0441\u0442\u0443\u043F\u043B\u0435\u043D\u0438\u0435 \u0432\u0442\u043E\u0440\u043E\u0433\u043E \u0434\u043D\u0430", "\u4E8C\u3064\u76EE\u306E\u5E95\u306E\u5165\u308A", "\uB450 \uBC88\uC9F8 \uBC14\uB2E5 \uC9C4\uC785", "\u7B2C\u4E8C\u5E95\u7684\u8FDB\u5165", "\u0E08\u0E38\u0E14\u0E40\u0E02\u0E49\u0E32\u0E02\u0E2D\u0E07\u0E01\u0E49\u0E19\u0E17\u0E35\u0E48\u0E2A\u0E2D\u0E07"],
  "Fuente del aire": ["Air source", "Fonte do ar", "Source de l\u2019air", "Airearen iturria", "\u0418\u0441\u0442\u043E\u0447\u043D\u0438\u043A \u0432\u043E\u0437\u0434\u0443\u0445\u0430", "\u30A8\u30A2\u306E\u30BD\u30FC\u30B9", "\uACF5\uAE30 \uC18C\uC2A4", "\u6C14\u606F\u6765\u6E90", "\u0E41\u0E2B\u0E25\u0E48\u0E07\u0E25\u0E21"],
  "\xCDndice del realce": ["Enhancer index", "\xCDndice do realce", "Indice du rehausseur", "Indartzailearen indizea", "\u0418\u043D\u0434\u0435\u043A\u0441 \u0443\u0441\u0438\u043B\u0438\u0442\u0435\u043B\u044F", "\u30A8\u30F3\u30CF\u30F3\u30B5\u30FC\u306E\u30A4\u30F3\u30C7\u30C3\u30AF\u30B9", "\uC778\uD578\uC11C \uC778\uB371\uC2A4", "\u589E\u5F3A\u6307\u6570", "\u0E14\u0E31\u0E0A\u0E19\u0E35\u0E02\u0E2D\u0E07\u0E15\u0E31\u0E27\u0E40\u0E2A\u0E23\u0E34\u0E21"],
  "Raz\xF3n del realce": ["Enhancer ratio", "Raz\xE3o do realce", "Rapport du rehausseur", "Indartzailearen arrazoia", "\u0421\u043E\u043E\u0442\u043D\u043E\u0448\u0435\u043D\u0438\u0435 \u0443\u0441\u0438\u043B\u0438\u0442\u0435\u043B\u044F", "\u30A8\u30F3\u30CF\u30F3\u30B5\u30FC\u306E\u30EC\u30B7\u30AA", "\uC778\uD578\uC11C \uBE44\uC728", "\u589E\u5F3A\u6BD4\u7387", "\u0E2D\u0E31\u0E15\u0E23\u0E32\u0E2A\u0E48\u0E27\u0E19\u0E02\u0E2D\u0E07\u0E15\u0E31\u0E27\u0E40\u0E2A\u0E23\u0E34\u0E21"],
  "Realimentaci\xF3n del resonador": ["Resonator feedback", "Realimenta\xE7\xE3o do ressonador", "R\xE9injection du r\xE9sonateur", "Erresonadorearen atzeraelikadura", "\u041E\u0431\u0440\u0430\u0442\u043D\u0430\u044F \u0441\u0432\u044F\u0437\u044C \u0440\u0435\u0437\u043E\u043D\u0430\u0442\u043E\u0440\u0430", "\u30EC\u30BE\u30CD\u30FC\u30BF\u30FC\u306E\u30D5\u30A3\u30FC\u30C9\u30D0\u30C3\u30AF", "\uB808\uC870\uB124\uC774\uD130 \uD53C\uB4DC\uBC31", "\u5171\u9E23\u5668\u53CD\u9988", "\u0E1F\u0E35\u0E14\u0E41\u0E1A\u0E47\u0E01\u0E02\u0E2D\u0E07\u0E15\u0E31\u0E27\u0E2A\u0E31\u0E48\u0E19\u0E1E\u0E49\u0E2D\u0E07"],
  "Raz\xF3n del resonador": ["Resonator ratio", "Raz\xE3o do ressonador", "Rapport du r\xE9sonateur", "Erresonadorearen arrazoia", "\u0421\u043E\u043E\u0442\u043D\u043E\u0448\u0435\u043D\u0438\u0435 \u0440\u0435\u0437\u043E\u043D\u0430\u0442\u043E\u0440\u0430", "\u30EC\u30BE\u30CD\u30FC\u30BF\u30FC\u306E\u30EC\u30B7\u30AA", "\uB808\uC870\uB124\uC774\uD130 \uBE44\uC728", "\u5171\u9E23\u5668\u6BD4\u7387", "\u0E2D\u0E31\u0E15\u0E23\u0E32\u0E2A\u0E48\u0E27\u0E19\u0E02\u0E2D\u0E07\u0E15\u0E31\u0E27\u0E2A\u0E31\u0E48\u0E19\u0E1E\u0E49\u0E2D\u0E07"],
  "Tama\xF1o del cuerpo": ["Body size", "Tamanho do corpo", "Taille du corps", "Gorputzaren tamaina", "\u0420\u0430\u0437\u043C\u0435\u0440 \u043A\u043E\u0440\u043F\u0443\u0441\u0430", "\u30DC\u30C7\u30A3\u306E\u30B5\u30A4\u30BA", "\uBC14\uB514 \uD06C\uAE30", "\u7434\u4F53\u5927\u5C0F", "\u0E02\u0E19\u0E32\u0E14\u0E1A\u0E2D\u0E14\u0E35\u0E49"],
  "Tipo de cuerpo": ["Body type", "Tipo de corpo", "Type de corps", "Gorputz mota", "\u0422\u0438\u043F \u043A\u043E\u0440\u043F\u0443\u0441\u0430", "\u30DC\u30C7\u30A3\u306E\u30BF\u30A4\u30D7", "\uBC14\uB514 \uD0C0\uC785", "\u7434\u4F53\u7C7B\u578B", "\u0E0A\u0E19\u0E34\u0E14\u0E1A\u0E2D\u0E14\u0E35\u0E49"],
  Extremo: ["End", "Extremidade", "Extr\xE9mit\xE9", "Muturra", "\u041A\u043E\u043D\u0435\u0446", "\u7D42\u7AEF", "\uB05D", "\u7AEF", "\u0E1B\u0E25\u0E32\u0E22"],
  Largo: ["Length", "Comprimento", "Longueur", "Luzera", "\u0414\u043B\u0438\u043D\u0430", "\u9577\u3055", "\uAE38\uC774", "\u957F\u5EA6", "\u0E04\u0E27\u0E32\u0E21\u0E22\u0E32\u0E27"],
  Aliento: ["Breath", "F\xF4lego", "Souffle", "Arnasa", "\u0414\u044B\u0445\u0430\u043D\u0438\u0435", "\u30D6\u30EC\u30B9", "\uC228", "\u6C14\u606F", "\u0E25\u0E21\u0E2B\u0E32\u0E22\u0E43\u0E08"],
  Subida: ["Rise", "Subida", "Mont\xE9e", "Igoera", "\u041F\u043E\u0434\u044A\u0451\u043C", "\u4E0A\u6607", "\uC0C1\uC2B9", "\u5347\u9AD8", "\u0E01\u0E32\u0E23\u0E02\u0E36\u0E49\u0E19"],
  "Aire desde": ["Air from", "Ar desde", "Air depuis", "Airea nondik", "\u0412\u043E\u0437\u0434\u0443\u0445 \u043E\u0442", "\u30A8\u30A2\u306E\u5165\u529B", "\uACF5\uAE30 \uC785\uB825", "\u6C14\u606F\u6765\u81EA", "\u0E25\u0E21\u0E08\u0E32\u0E01"],
  Realce: ["Enhance", "Realce", "Rehausse", "Indartzea", "\u0423\u0441\u0438\u043B\u0435\u043D\u0438\u0435", "\u30A8\u30F3\u30CF\u30F3\u30B9", "\uAC15\uC870", "\u589E\u5F3A", "\u0E01\u0E32\u0E23\u0E40\u0E2A\u0E23\u0E34\u0E21"],
  "\xCDndice": ["Index", "\xCDndice", "Indice", "Indizea", "\u0418\u043D\u0434\u0435\u043A\u0441", "\u30A4\u30F3\u30C7\u30C3\u30AF\u30B9", "\uC778\uB371\uC2A4", "\u6307\u6570", "\u0E14\u0E31\u0E0A\u0E19\u0E35"],
  "Tama\xF1o": ["Size", "Tamanho", "Taille", "Tamaina", "\u0420\u0430\u0437\u043C\u0435\u0440", "\u30B5\u30A4\u30BA", "\uD06C\uAE30", "\u5927\u5C0F", "\u0E02\u0E19\u0E32\u0E14"],
  Abierto: ["Open", "Aberto", "Ouvert", "Irekia", "\u041E\u0442\u043A\u0440\u044B\u0442\u044B\u0439", "\u958B\u7BA1", "\uC5F4\uB9BC", "\u5F00\u53E3", "\u0E40\u0E1B\u0E34\u0E14"],
  Cerrado: ["Closed", "Fechado", "Ferm\xE9", "Itxia", "\u0417\u0430\u043A\u0440\u044B\u0442\u044B\u0439", "\u9589\u7BA1", "\uB2EB\uD798", "\u95ED\u53E3", "\u0E1B\u0E34\u0E14"],
  Recto: ["Straight", "Reto", "Droit", "Zuzena", "\u041F\u0440\u044F\u043C\u043E\u0439", "\u30B9\u30C8\u30EC\u30FC\u30C8", "\uC9C1\uAD00", "\u76F4\u7BA1", "\u0E15\u0E23\u0E07"],
  "C\xF3nico": ["Conical", "C\xF4nico", "Conique", "Konikoa", "\u041A\u043E\u043D\u0438\u0447\u0435\u0441\u043A\u0438\u0439", "\u5186\u9310", "\uC6D0\uBFD4\uD615", "\u9525\u5F62", "\u0E17\u0E23\u0E07\u0E01\u0E23\u0E27\u0E22"],
  "Sigue la nota": ["Follows the note", "Segue a nota", "Suit la note", "Notari jarraitzen dio", "\u0421\u043B\u0435\u0434\u0443\u0435\u0442 \u0437\u0430 \u043D\u043E\u0442\u043E\u0439", "\u30CE\u30FC\u30C8\u306B\u8FFD\u5F93", "\uB178\uD2B8\uB97C \uB530\uB984", "\u8DDF\u968F\u97F3\u7B26", "\u0E15\u0E32\u0E21\u0E42\u0E19\u0E49\u0E15"],
  Fijo: ["Fixed", "Fixo", "Fixe", "Finkoa", "\u0424\u0438\u043A\u0441\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u0439", "\u56FA\u5B9A", "\uACE0\uC815", "\u56FA\u5B9A", "\u0E04\u0E07\u0E17\u0E35\u0E48"],
  Bisel: ["Edge (flute)", "Bisel", "Biseau", "Ertza", "\u041B\u0430\u0431\u0438\u0443\u043C", "\u30A8\u30C3\u30B8(\u30D5\u30EB\u30FC\u30C8)", "\uC5E3\uC9C0(\uD50C\uB8E8\uD2B8)", "\u8FB9\u68F1(\u7B1B)", "\u0E02\u0E2D\u0E1A\u0E40\u0E1B\u0E48\u0E32 (\u0E02\u0E25\u0E38\u0E48\u0E22)"],
  Labios: ["Lips (brass)", "L\xE1bios", "L\xE8vres", "Ezpainak", "\u0413\u0443\u0431\u044B", "\u30EA\u30C3\u30D7(\u91D1\u7BA1)", "\uC785\uC220(\uAE08\uAD00)", "\u5507(\u94DC\u7BA1)", "\u0E23\u0E34\u0E21\u0E1D\u0E35\u0E1B\u0E32\u0E01 (\u0E17\u0E2D\u0E07\u0E40\u0E2B\u0E25\u0E37\u0E2D\u0E07)"],
  "Ca\xF1a": ["Reed", "Palheta", "Anche", "Lingeta", "\u0422\u0440\u043E\u0441\u0442\u044C", "\u30EA\u30FC\u30C9", "\uB9AC\uB4DC", "\u7C27\u7247", "\u0E25\u0E34\u0E49\u0E19"],
  Rueda: ["Mod wheel", "Roda", "Molette", "Gurpila", "\u041A\u043E\u043B\u0435\u0441\u043E", "\u30E2\u30B8\u30E5\u30EC\u30FC\u30B7\u30E7\u30F3\u30FB\u30DB\u30A4\u30FC\u30EB", "\uBAA8\uB4C8\uB808\uC774\uC158 \uD720", "\u8C03\u5236\u8F6E", "\u0E25\u0E49\u0E2D\u0E21\u0E2D\u0E14\u0E39\u0E40\u0E25\u0E0A\u0E31\u0E19"],
  "Expresi\xF3n": ["Expression", "Express\xE3o", "Expression", "Adierazpena", "\u042D\u043A\u0441\u043F\u0440\u0435\u0441\u0441\u0438\u044F", "\u30A8\u30AF\u30B9\u30D7\u30EC\u30C3\u30B7\u30E7\u30F3", "\uC775\uC2A4\uD504\uB808\uC158", "\u8868\u60C5", "\u0E40\u0E2D\u0E47\u0E01\u0E0B\u0E4C\u0E40\u0E1E\u0E23\u0E2A\u0E0A\u0E31\u0E19"],
  Aftertouch: ["Aftertouch", "Aftertouch", "Aftertouch", "Aftertouch", "\u041F\u043E\u0441\u043B\u0435\u043A\u0430\u0441\u0430\u043D\u0438\u0435", "\u30A2\u30D5\u30BF\u30FC\u30BF\u30C3\u30C1", "\uC560\uD504\uD130\uD130\uCE58", "\u89E6\u540E", "\u0E2D\u0E32\u0E1F\u0E40\u0E15\u0E2D\u0E23\u0E4C\u0E17\u0E31\u0E0A"],
  Madera: ["Wood", "Madeira", "Bois", "Egurra", "\u0414\u0435\u0440\u0435\u0432\u043E", "\u6728", "\uB098\uBB34", "\u6728", "\u0E44\u0E21\u0E49"],
  Caja: ["Box", "Caixa", "Caisse", "Kutxa", "\u042F\u0449\u0438\u043A", "\u30DC\u30C3\u30AF\u30B9", "\uC0C1\uC790", "\u7BB1", "\u0E01\u0E25\u0E48\u0E2D\u0E07"],
  Tajadas: ["Slices", "Fatias", "Tranches", "Xerrak", "\u041D\u0430\u0440\u0435\u0437\u043A\u0430", "\u30B9\u30E9\u30A4\u30B9", "\uC2AC\uB77C\uC774\uC2A4", "\u5207\u7247", "\u0E2A\u0E44\u0E25\u0E0B\u0E4C"],
  "Nueva zona de tajadas": ["New slice zone", "Nova zona de fatias", "Nouvelle zone de tranches", "Xerra-eremu berria", "\u041D\u043E\u0432\u0430\u044F \u0437\u043E\u043D\u0430 \u043D\u0430\u0440\u0435\u0437\u043A\u0438", "\u65B0\u3057\u3044\u30B9\u30E9\u30A4\u30B9\u30BE\u30FC\u30F3", "\uC0C8 \uC2AC\uB77C\uC774\uC2A4 \uC874", "\u65B0\u5EFA\u5207\u7247\u533A\u57DF", "\u0E42\u0E0B\u0E19\u0E2A\u0E44\u0E25\u0E0B\u0E4C\u0E43\u0E2B\u0E21\u0E48"],
  Detectar: ["Detect", "Detectar", "D\xE9tecter", "Detektatu", "\u041D\u0430\u0439\u0442\u0438", "\u691C\u51FA", "\uAC10\uC9C0", "\u68C0\u6D4B", "\u0E15\u0E23\u0E27\u0E08\u0E2B\u0E32"],
  "Detectar los golpes": ["Detect the hits", "Detectar os golpes", "D\xE9tecter les attaques", "Detektatu kolpeak", "\u041D\u0430\u0439\u0442\u0438 \u0443\u0434\u0430\u0440\u044B", "\u30A2\u30BF\u30C3\u30AF\u3092\u691C\u51FA", "\uD0C0\uACA9 \uAC10\uC9C0", "\u68C0\u6D4B\u6572\u51FB", "\u0E15\u0E23\u0E27\u0E08\u0E2B\u0E32\u0E08\u0E31\u0E07\u0E2B\u0E27\u0E30\u0E01\u0E23\u0E30\u0E17\u0E1A"],
  Partes: ["Parts", "Partes", "Parties", "Zatiak", "\u0427\u0430\u0441\u0442\u0438", "\u5206\u5272\u6570", "\uBD84\uD560 \uC218", "\u4EFD\u6570", "\u0E08\u0E33\u0E19\u0E27\u0E19\u0E2A\u0E48\u0E27\u0E19"],
  "Partes iguales": ["Equal parts", "Partes iguais", "Parts \xE9gales", "Zati berdinak", "\u0420\u0430\u0432\u043D\u044B\u0435 \u0447\u0430\u0441\u0442\u0438", "\u5747\u7B49\u306B\u5206\u5272", "\uADE0\uB4F1 \uBD84\uD560", "\u7B49\u5206", "\u0E41\u0E1A\u0E48\u0E07\u0E40\u0E17\u0E48\u0E32 \u0E46 \u0E01\u0E31\u0E19"],
  "Clic: o\xEDr la tajada \xB7 doble clic: agregar o quitar un corte": ["Click: hear the slice \xB7 double-click: add or remove a cut", "Clique: ouvir a fatia \xB7 duplo clique: adicionar ou tirar um corte", "Clic : \xE9couter la tranche \xB7 double clic : ajouter ou retirer une coupe", "Klik: entzun xerra \xB7 klik bikoitza: gehitu edo kendu ebaki bat", "\u0429\u0435\u043B\u0447\u043E\u043A: \u043F\u0440\u043E\u0441\u043B\u0443\u0448\u0430\u0442\u044C \u0444\u0440\u0430\u0433\u043C\u0435\u043D\u0442 \xB7 \u0434\u0432\u043E\u0439\u043D\u043E\u0439 \u0449\u0435\u043B\u0447\u043E\u043A: \u0434\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0438\u043B\u0438 \u0443\u0431\u0440\u0430\u0442\u044C \u0440\u0430\u0437\u0440\u0435\u0437", "\u30AF\u30EA\u30C3\u30AF: \u30B9\u30E9\u30A4\u30B9\u3092\u8A66\u8074 \xB7 \u30C0\u30D6\u30EB\u30AF\u30EA\u30C3\u30AF: \u30AB\u30C3\u30C8\u3092\u8FFD\u52A0\u30FB\u524A\u9664", "\uD074\uB9AD: \uC2AC\uB77C\uC774\uC2A4 \uB4E3\uAE30 \xB7 \uB354\uBE14 \uD074\uB9AD: \uC790\uB974\uAE30 \uCD94\uAC00 \uB610\uB294 \uC81C\uAC70", "\u5355\u51FB\uFF1A\u8BD5\u542C\u5207\u7247 \xB7 \u53CC\u51FB\uFF1A\u6DFB\u52A0\u6216\u5220\u9664\u5207\u70B9", "\u0E04\u0E25\u0E34\u0E01: \u0E1F\u0E31\u0E07\u0E2A\u0E44\u0E25\u0E0B\u0E4C \xB7 \u0E14\u0E31\u0E1A\u0E40\u0E1A\u0E34\u0E25\u0E04\u0E25\u0E34\u0E01: \u0E40\u0E1E\u0E34\u0E48\u0E21\u0E2B\u0E23\u0E37\u0E2D\u0E25\u0E1A\u0E08\u0E38\u0E14\u0E15\u0E31\u0E14"],
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
  const m = /^(Banda|Capa) (\d+)(?:: (.+))?$/.exec(String(texto));
  if (!m) return texto;
  const resto = m[3] ? m[3].split(": ").map((x) => t(x, cual)).join(": ") : "";
  return `${t(m[1], cual)} ${m[2]}${resto ? `: ${resto}` : ""}`;
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
    const copia2 = Object.assign(Object.create(Object.getPrototypeOf(x)), x);
    if (typeof x.label === "string") copia2.label = tEtiqueta(x.label, cual);
    if (Array.isArray(x.choices)) copia2.choices = x.choices.map((c) => t(String(c), cual));
    sal[id] = copia2;
  }
  return sal;
}

// sampler/tajadas.js
var HOP = 256;
var SEPARACION_S = 0.05;
var PISO_DB = 45;
function energias(canales, fm) {
  const n = canales.length ? canales[0].length : 0;
  const tramos = Math.ceil(n / HOP);
  const db = new Float32Array(tramos);
  let antes = 0;
  for (let k = 0; k < tramos; k++) {
    let suma = 0;
    const z = Math.min(n, (k + 1) * HOP);
    for (let i = k * HOP; i < z; i++) {
      let x = 0;
      for (const c of canales) x += c[i];
      x /= canales.length;
      const d = x - antes;
      antes = x;
      suma += d * d;
    }
    db[k] = 10 * Math.log10(suma / HOP + 1e-12);
  }
  return { db, seg: HOP / fm };
}
function golpes(en, sens = 50) {
  const { db, seg } = en;
  const n = db.length;
  if (!n) return [];
  const s = Math.max(0, Math.min(100, Number(sens)));
  const umbral = 4 + (1 - s / 100) * 14;
  let tope = -Infinity;
  for (const x of db) if (x > tope) tope = x;
  const piso = tope - PISO_DB;
  const L = (k) => k < 0 ? -120 : db[Math.min(n - 1, k)];
  const sube = new Float32Array(n);
  for (let k = 0; k < n; k++) sube[k] = Math.max(0, L(k) - Math.max(L(k - 1), L(k - 2)));
  const sep = Math.max(1, Math.round(SEPARACION_S / seg));
  const out = [];
  let ultimo = -Infinity;
  for (let k = 0; k < n; k++) {
    if (sube[k] < umbral || db[k] < piso) continue;
    if (sube[k] < (k > 0 ? sube[k - 1] : 0) || sube[k] < (k + 1 < n ? sube[k + 1] : 0)) continue;
    if (k - ultimo < sep) continue;
    ultimo = k;
    const k0 = k > 0 && L(k - 1) > L(k - 2) + 3 ? k - 1 : k;
    out.push(Math.max(0, k0 * seg));
  }
  return out;
}
var parejos = (dur, n) => Array.from({ length: Math.max(1, n) }, (_, i) => i * dur / Math.max(1, n));

// sampler/moldear.js
var W = 536;
var H = 130;
var MESETA = 64;
var X0 = 8;
var anchoDe = (ms) => 4 + 106 * Math.log10(1 + Math.max(0, ms)) / 4;
var tiempoDe = (ancho) => Math.max(0.5, Math.min(1e4, Math.pow(10, (Math.max(4, ancho) - 4) * 4 / 106) - 1));
var PUNTOS = {
  vol: [{ fijo: 0 }, { t: "vat", l: "val" }, { t: "vdt", l: "vbp" }, { t: "vst", l: "vsl" }, { t: "vrt", fijo: 0, meseta: true }],
  fil: [{ l: "fl0" }, { t: "fat", l: "fal" }, { t: "fdt", l: "fbp" }, { t: "fst", l: "fsl" }, { t: "frt", l: "frl", meseta: true }],
  alt: [{ l: "pl0" }, { t: "pat", l: "pal" }, { t: "pdt", fijo: 0 }, { t: "prt", l: "prl", meseta: true }]
};
var BIPOLAR = { vol: false, fil: true, alt: true };
var ROTULOS = { vat: "A", vdt: "D", vst: "S", vrt: "R", fat: "A", fdt: "D", fst: "S", frt: "R", pat: "A", pdt: "D", prt: "R" };
var FILAS = [
  ["capa", ""],
  ["env", ""],
  ["vel", "Intensidad de la nota"],
  ["tec", "Tecla"]
];
function crearMoldeado(nodo, N2, colores) {
  let capa = 1;
  let hoja = "vol";
  const valores = {};
  for (const p of N2.PARAMS) valores[p.id] = p.defecto;
  const controles = {};
  let tomado = -1;
  const caja = el("div", "padding:6px 10px 8px;");
  const dibujo = lienzo(W, H);
  dibujo.c.style.cursor = "grab";
  const cuerpo = el("div", "");
  caja.append(dibujo.c, cuerpo);
  const extras = [];
  const id = (corto) => `c${capa}${corto}`;
  const leer = (corto) => Number(valores[id(corto)]);
  const mandar = (corto, x) => {
    valores[id(corto)] = x;
    void nodo.setParameterValues({ [id(corto)]: { id: id(corto), value: x, normalized: false } });
  };
  const paramDe = (corto) => N2.PARAMS.find((p) => p.id === `c1${corto}`);
  const NOMBRES2 = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const textoDe = (p, x) => p.nota ? `${NOMBRES2[Math.round(x) % 12]}${Math.floor(Math.round(x) / 12) - 1}` : `${numero(x, p.dec !== void 0 ? p.dec : 0)}${p.unidad ? ` ${p.unidad}` : ""}`;
  const control = (p, mapa) => {
    const corto = p.id.slice(2);
    const nombre = t(p.corto || p.nombre.replace(/^Capa \d+: /, ""));
    if (p.tipo === "choice") {
      const c2 = elegidor({ nombre, opciones: p.opciones.map((x) => t(x)), alCambiar: (i) => mandar(corto, i) });
      const celda = el("div", `display:flex;flex-direction:column;align-items:center;gap:6px;min-width:0;${p.angosto ? "" : "grid-column:span 2;"}`);
      celda.append(el("div", `color:${v("tinta2")};font-size:11px;white-space:nowrap;`, nombre), c2.el);
      mapa[corto] = { ...c2, poner: (x) => c2.poner(Math.round(x)), p, caja: celda };
      return celda;
    }
    const c = perilla({
      nombre,
      min: p.min,
      max: p.max,
      paso: p.paso || 1,
      log: !!p.log,
      porDefecto: p.defecto,
      formato: (x) => textoDe(p, x),
      alCambiar: (x) => {
        mandar(corto, x);
        pintar();
      }
    });
    mapa[corto] = { ...c, p, caja: c.el };
    return c.el;
  };
  const armar = () => {
    cuerpo.textContent = "";
    for (const k of Object.keys(controles)) delete controles[k];
    const ps = N2.PARAMS.filter((p) => p.grupo === `c1${hoja}`);
    for (const [sub, rotulo] of FILAS) {
      const deFila = ps.filter((p) => p.sub === sub && !(hoja === "vol" && sub === "capa"));
      if (!deFila.length) continue;
      const fila = el("div", "display:flex;align-items:flex-start;gap:6px;margin-top:6px;");
      if (rotulo) fila.append(el("div", `width:70px;flex:none;color:${v("tinta2")};font-size:11px;padding-top:14px;`, t(rotulo)));
      const lugares = deFila.reduce((n, p) => n + (p.tipo === "choice" && !p.angosto ? 2 : 1), 0);
      const grilla = el("div", `flex:1;display:grid;grid-template-columns:repeat(${Math.max(lugares, rotulo ? 6 : 7)},minmax(0,1fr));gap:4px;align-items:start;`);
      for (const p of deFila) grilla.append(control(p, controles));
      fila.append(grilla);
      cuerpo.append(fila);
    }
    refrescar();
  };
  const refrescar = () => {
    const modelo = Math.round(leer("smt"));
    for (const mapa of [controles, ...extras])
      for (const [corto, c] of Object.entries(mapa)) {
        if (!c.agarrada()) c.poner(leer(corto));
        if (c.p && c.p.solo) c.caja.style.opacity = c.p.solo.includes(modelo) ? "" : "0.35";
      }
    pintar();
  };
  const yDe = (nivel) => {
    const bip = BIPOLAR[hoja];
    const arriba = 10;
    const abajo = H - 14;
    return bip ? arriba + (1 - nivel) / 2 * (abajo - arriba) : abajo - nivel * (abajo - arriba);
  };
  const nivelDe = (y) => {
    const bip = BIPOLAR[hoja];
    const arriba = 10;
    const abajo = H - 14;
    const r = (y - arriba) / (abajo - arriba);
    return Math.max(bip ? -1 : 0, Math.min(1, bip ? 1 - 2 * r : 1 - r));
  };
  const posiciones = () => {
    const out = [];
    let x = X0;
    for (const pt of PUNTOS[hoja]) {
      if (pt.meseta) x += MESETA;
      if (pt.t) x += anchoDe(leer(pt.t));
      const nivel = pt.l ? leer(pt.l) / 100 : pt.fijo;
      out.push({ x, y: yDe(nivel), pt });
    }
    return out;
  };
  const pintar = () => {
    const C = colores();
    const g = dibujo.g;
    g.fillStyle = C.pantalla;
    g.fillRect(0, 0, W, H);
    g.strokeStyle = C.borde;
    g.strokeRect(0.5, 0.5, W - 1, H - 1);
    g.strokeStyle = C.borde;
    g.setLineDash([3, 3]);
    g.beginPath();
    g.moveTo(0, Math.round(yDe(0)) + 0.5);
    g.lineTo(W, Math.round(yDe(0)) + 0.5);
    g.stroke();
    g.setLineDash([]);
    const ps = posiciones();
    const im = PUNTOS[hoja].findIndex((p) => p.meseta);
    if (im > 0) {
      g.fillStyle = C.acento;
      g.globalAlpha = 0.12;
      g.fillRect(ps[im - 1].x, 1, MESETA, H - 2);
      g.globalAlpha = 1;
    }
    g.strokeStyle = C.acento;
    g.lineWidth = 2;
    g.beginPath();
    ps.forEach((q, i) => {
      if (i === 0) g.moveTo(q.x, q.y);
      else {
        if (q.pt.meseta) g.lineTo(ps[i - 1].x + MESETA, ps[i - 1].y);
        g.lineTo(q.x, q.y);
      }
    });
    g.stroke();
    g.lineWidth = 1;
    g.font = "10px system-ui, sans-serif";
    g.textAlign = "center";
    ps.forEach((q, i) => {
      const movible = !!(q.pt.t || q.pt.l);
      g.fillStyle = i === tomado ? C.tinta : movible ? C.fondo : C.borde;
      g.strokeStyle = C.tinta;
      g.beginPath();
      g.arc(q.x, q.y, movible ? 5 : 3, 0, 2 * Math.PI);
      g.fill();
      g.stroke();
      if (q.pt.t) {
        const xa = q.pt.meseta ? ps[i - 1].x + MESETA : ps[i - 1].x;
        g.fillStyle = C.tinta2;
        g.fillText(ROTULOS[q.pt.t] || "", (xa + q.x) / 2, H - 3);
      }
    });
    if (im > 0) {
      g.fillStyle = C.tinta2;
      g.fillText(t("Sostenido"), ps[im - 1].x + MESETA / 2, 12);
    }
  };
  const local = (ev) => {
    const r = dibujo.c.getBoundingClientRect();
    return { x: (ev.clientX - r.left) * W / r.width, y: (ev.clientY - r.top) * H / r.height };
  };
  dibujo.c.addEventListener("pointerdown", (ev) => {
    const { x, y } = local(ev);
    const ps = posiciones();
    let mejor = -1;
    let dist = 12;
    ps.forEach((q, i) => {
      if (!q.pt.t && !q.pt.l) return;
      const d = Math.hypot(q.x - x, q.y - y);
      if (d < dist) {
        dist = d;
        mejor = i;
      }
    });
    if (mejor < 0) return;
    tomado = mejor;
    dibujo.c.style.cursor = "grabbing";
    try {
      dibujo.c.setPointerCapture(ev.pointerId);
    } catch (e) {
    }
    pintar();
  });
  dibujo.c.addEventListener("pointermove", (ev) => {
    if (tomado < 0) return;
    const { x, y } = local(ev);
    const ps = posiciones();
    const q = ps[tomado];
    if (q.pt.t) {
      const antes = tomado > 0 ? ps[tomado - 1].x + (q.pt.meseta ? MESETA : 0) : X0;
      const ms = tiempoDe(x - antes);
      const p = paramDe(q.pt.t);
      mandar(q.pt.t, Math.max(p.min, Math.min(p.max, Math.round(ms * 10) / 10)));
    }
    if (q.pt.l) mandar(q.pt.l, Math.round(nivelDe(y) * 100));
    refrescar();
  });
  const soltarPunto = () => {
    if (tomado < 0) return;
    tomado = -1;
    dibujo.c.style.cursor = "grab";
    pintar();
  };
  dibujo.c.addEventListener("pointerup", soltarPunto);
  dibujo.c.addEventListener("pointercancel", soltarPunto);
  const ponerHoja = (h) => {
    hoja = h;
    armar();
  };
  ponerHoja("vol");
  return {
    el: caja,
    // La capa elegida arriba (1…3).
    ponerCapa(k) {
      if (k === capa) return;
      capa = k;
      refrescar();
    },
    // 'vol' | 'fil' | 'alt'
    ponerHoja,
    // Lo que vale ahora un parámetro (el id entero), según lo último que dijo el plugin.
    valor: (id2) => valores[id2],
    // Controles de la capa elegida para otra carpeta: una fila con estos parámetros (cortos).
    crearGrupo(cortos) {
      const mapa = {};
      const ps = cortos.map(paramDe).filter(Boolean);
      const lugares = ps.reduce((n, p) => n + (p.tipo === "choice" && !p.angosto ? 2 : 1), 0);
      const grilla = el("div", `display:grid;grid-template-columns:repeat(${Math.max(lugares, 7)},minmax(0,1fr));gap:4px;align-items:start;`);
      for (const p of ps) grilla.append(control(p, mapa));
      extras.push(mapa);
      for (const [corto, c] of Object.entries(mapa)) c.poner(leer(corto));
      return grilla;
    },
    // Lo que el plugin dice ahora (cada medio segundo): no pisa lo que se está tocando.
    ponerValores(vals) {
      for (const p of N2.PARAMS) if (vals[p.id] && vals[p.id].value !== void 0 && !(tomado >= 0 && p.id.startsWith(`c${capa}`))) valores[p.id] = Number(vals[p.id].value);
      if (tomado < 0) refrescar();
    },
    pintar,
    iniciar() {
      refrescar();
    }
  };
}

// sampler/presets.js
var FORMATO = "pz-sampler-preset";
var LLAVE = "pz-wam-sampler-presets";
var SOPLO = { zonas: [{ baja: 0, alta: 127, raiz: 60, capas: [{ mod: {} }] }] };
var BASE_SOPLO = { vat: 30, vrt: 120, vvs: 0 };
var FABRICA = [
  {
    nombre: "Trutruka (ca\xF1er\xEDa de agua y cacho de vaca)",
    inst: SOPLO,
    capa1: { ...BASE_SOPLO, smt: 1, stb: 1, stn: 28, stf: -50, sgm: 1, sdc: 20, slh: 35, sdh: 90, sfh: 50, slb: 1, slg: 1, slt: 60, sai: 60, sru: 15, sgl: 30, srs: 30, svn: 20, vat: 30, vrt: 80, sds: 20, sdt: 300 }
  },
  {
    nombre: "\xD1olki\xF1 de ca\xF1er\xEDa (gas y cacho de cabra)",
    inst: SOPLO,
    capa1: { ...BASE_SOPLO, smt: 1, stb: 1, stn: 43, stf: -30, sgm: 1, slb: 1, ssn: 1, sdc: 10, slh: 18, sdh: 45, sfh: 60, slg: 1, slt: 80, sgl: 40, srs: 40, svn: 30, sai: 55, vat: 100, vrt: 80, sin: 18, siv: 6, sca: 30, sru: 100, sbo: 100 }
  },
  {
    nombre: "\xD1olki\xF1 de tallo (con cono de hoja)",
    inst: SOPLO,
    capa1: { ...BASE_SOPLO, smt: 1, stb: 1, sgm: 1, slm: 1, slc: 145, sdc: 20, slh: 20, sdh: 80, sfh: 0, spa: 30, scb: 50, ssn: 1, slb: 1, sgl: 40, srs: 40, svn: 30, sai: 75, vrt: 80, sin: 18, siv: 6, sru: 20, sbo: 40, sca: 100, vat: 160, stc: 6 }
  }
];
function estadoDeFabrica(P, params) {
  const parameterValues = {};
  for (const p of params) parameterValues[p.id] = { id: p.id, value: p.defecto, normalized: false };
  for (const [k, x] of Object.entries(P.capa1 || {})) {
    const id = `c1${k}`;
    if (parameterValues[id]) parameterValues[id].value = x;
  }
  return { parameterValues, inst: JSON.parse(JSON.stringify(P.inst)), muestras: {} };
}
var empaquetar = (nombre, estado) => ({ formato: FORMATO, version: 1, nombre, estado });
function desempaquetar(d) {
  if (!d || typeof d !== "object" || d.formato !== FORMATO || !d.estado || typeof d.estado !== "object") return null;
  return { nombre: typeof d.nombre === "string" ? d.nombre : "", estado: d.estado };
}
var sinDireccion = (nodo) => Object.values(nodo.muestras || {}).filter((x) => !x.url).length;
function leerPropios() {
  try {
    const l = JSON.parse(globalThis.localStorage?.getItem(LLAVE) || "[]");
    return Array.isArray(l) ? l.filter((x) => x && typeof x.nombre === "string" && x.estado) : [];
  } catch {
    return [];
  }
}
function guardarPropio(nombre, estado) {
  const l = leerPropios().filter((x) => x.nombre !== nombre);
  l.push({ nombre, estado });
  l.sort((a, b) => a.nombre.localeCompare(b.nombre));
  try {
    globalThis.localStorage.setItem(LLAVE, JSON.stringify(l));
    return true;
  } catch {
    return false;
  }
}
function borrarPropio(nombre) {
  try {
    globalThis.localStorage.setItem(LLAVE, JSON.stringify(leerPropios().filter((x) => x.nombre !== nombre)));
  } catch {
  }
}

// sampler/caratula.js
var N = nucleoSampler();
var NOTA_BAJA = 24;
var NOTA_ALTA = 108;
var NOMBRES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
var nombreNota = (n) => `${NOMBRES[(n % 12 + 12) % 12]}${Math.floor(n / 12) - 1}`;
var negra = (n) => [1, 3, 6, 8, 10].includes((n % 12 + 12) % 12);
var entre = (x, a, b) => Math.min(b, Math.max(a, x));
var copia = (x) => JSON.parse(JSON.stringify(x));
var boton = (texto, alClic, titulo) => {
  const b = el("button", `font:inherit;font-size:11px;color:${v("tinta")};background:${v("pantalla")};border:1px solid ${v("borde")};padding:1px 6px;cursor:pointer;`, texto);
  b.type = "button";
  if (titulo) b.title = titulo;
  b.addEventListener("click", alClic);
  return b;
};
function crearCaratula(nodo) {
  const dibujarTuboMedido = (g, val, k) => {
    const gp = {};
    for (const p of N.PARAMS) if (p.id.startsWith(`c${k}`)) gp[p.id.slice(String(k).length + 1)] = val(p.id.slice(String(k).length + 1), p.defecto);
    const med = N.medidaTubo(gp);
    const Lc = gp.stb < 0.5 ? 140 : med.cm;
    const Lh = gp.slh;
    const dc = gp.sdc;
    const db = Math.max(dc, gp.sdh);
    const gam = 1 + 3 * gp.sfh / 100;
    const enr = Math.round(gp.sen);
    const vueltas = Math.max(1, Math.round(gp.svu));
    const C2 = { tinta: v("tinta"), acento: v("acento"), tinta2: v("tinta2") };
    const ey = Math.min(1.2, 80 / db);
    const ac = Math.max(3, dc * ey);
    g.strokeStyle = C2.tinta;
    g.fillStyle = C2.acento;
    g.lineWidth = 1.5;
    const cacho = (x0, y0, largo) => {
      if (Lh <= 0) return;
      g.beginPath();
      for (let i = 0; i <= 30; i++) {
        const f = i / 30;
        const a = ac / 2 + (db * ey - ac) / 2 * Math.pow(f, gam);
        if (i === 0) g.moveTo(x0 + f * largo, y0 - a);
        else g.lineTo(x0 + f * largo, y0 - a);
      }
      for (let i = 30; i >= 0; i--) {
        const f = i / 30;
        const a = ac / 2 + (db * ey - ac) / 2 * Math.pow(f, gam);
        g.lineTo(x0 + f * largo, y0 + a);
      }
      g.closePath();
      g.globalAlpha = 0.25;
      g.fill();
      g.globalAlpha = 1;
      g.stroke();
    };
    const cy = 50;
    if (enr === 0) {
      const total = Math.max(1, Lc + Lh);
      const ex = 470 / total;
      const xc = 40 + Lc * ex;
      g.fillRect(28, cy - Math.max(3, ac / 2) - 2, 12, Math.max(6, ac) + 4);
      g.strokeRect(40, cy - ac / 2, Lc * ex, ac);
      cacho(xc, cy, Lh * ex);
    } else {
      const xLibre = 330;
      g.lineWidth = Math.min(6, Math.max(1.5, ac));
      g.beginPath();
      if (enr === 1) {
        const c0 = 120;
        for (let i = 0; i <= vueltas * 60; i++) {
          const a = i / 60 * 2 * Math.PI;
          const r = 8 + 36 * i / (vueltas * 60);
          const x = c0 + r * Math.cos(a);
          const y = cy + r * Math.sin(a);
          if (i === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.lineTo(xLibre, cy);
        g.stroke();
        g.fillRect(c0 + 4, cy - 4, 8, 8);
      } else {
        for (let j = 0; j < vueltas; j++) {
          const x0 = 60 + j * (200 / vueltas);
          g.ellipse(x0 + 60, cy, 60, 26 - 10 * j / vueltas, 0, 0, 2 * Math.PI);
        }
        g.moveTo(60 + 200 / vueltas * (vueltas - 1) + 120, cy);
        g.lineTo(xLibre, cy);
        g.stroke();
        g.fillRect(40, cy - 4, 14, 8);
      }
      g.lineWidth = 1.5;
      cacho(xLibre, cy, Math.min(200, Math.max(20, Lh * 3)));
    }
    g.lineWidth = 1;
    g.fillStyle = C2.tinta2;
    g.font = "11px system-ui, sans-serif";
    g.textAlign = "center";
    const nota = med.hz > 0 ? 69 + 12 * Math.log2(med.hz / 440) : 0;
    const n = Math.round(nota);
    const ct = Math.round((nota - n) * 100);
    const txtNota = med.hz > 0 ? `${nombreNota(n)} ${ct >= 0 ? "+" : "\u2212"}${Math.abs(ct)} ct` : "\u2014";
    const sigue = gp.stb < 0.5;
    const partes2 = [`${t("Soplo")}: ${t("Labios")}`, sigue ? `${t("Tubo")}: ${t("Sigue la nota").toLowerCase()} \xB7 ${dc} mm` : `${t("Tubo")} ${Lc.toFixed(1)} cm \xB7 ${dc} mm`];
    if (Lh > 0) partes2.push(`${t("Cacho")} ${Lh} cm \xB7 ${gp.sdh} mm`);
    if (!sigue) partes2.push(`${t("Nota del tubo")} ${txtNota}`);
    g.fillText(partes2.join("   "), 268, 104);
  };
  let inst = copia(nodo.inst);
  let zSel = inst.zonas.length ? 0 : -1;
  let cSel = 0;
  const guardar = () => nodo.ponerInstrumento(copia(inst));
  const zona = () => zSel >= 0 ? inst.zonas[zSel] : null;
  const capa = () => {
    const z = zona();
    return z ? z.capas[cSel] || null : null;
  };
  const caja = el(
    "div",
    `display:inline-flex;flex-direction:column;box-sizing:border-box;width:568px;user-select:none;background:${v("fondo")};color:${v("tinta")};border:1px solid ${v("borde")};font:12px/1.3 var(--pzw-letra,system-ui,sans-serif);`
  );
  const cabecera = el("div", `display:flex;flex-wrap:wrap;align-items:center;gap:3px;padding:6px 8px;border-bottom:1px solid ${v("borde")};`);
  cabecera.append(el("span", "font-weight:bold;font-size:13px;margin-right:4px;", t("Sampler")));
  const filaPresets = el("div", `display:flex;flex-wrap:wrap;align-items:center;gap:4px;padding:4px 8px;border-bottom:1px solid ${v("borde")};`);
  const estiloCampo = `font:inherit;font-size:11px;color:${v("tinta")};background:${v("pantalla")};border:1px solid ${v("borde")};padding:1px 4px;`;
  const selPreset = el("select", `${estiloCampo}max-width:230px;`);
  const nombrePreset = el("input", `${estiloCampo}width:120px;`);
  nombrePreset.placeholder = t("Nombre del preset");
  nombrePreset.addEventListener("keydown", (ev) => ev.stopPropagation());
  const avisoPreset = el("span", `color:${v("tinta2")};font-size:11px;`);
  const avisar = (texto) => {
    avisoPreset.textContent = texto;
    clearTimeout(avisar.reloj);
    avisar.reloj = setTimeout(() => avisoPreset.textContent = "", 4e3);
  };
  const pz = nodo.pz || {};
  let enCaja = [];
  const leerCaja = async () => {
    if (typeof pz.presets !== "function") return [];
    try {
      const l = await pz.presets();
      return Array.isArray(l) ? l.filter((x) => x && typeof x.nombre === "string" && desempaquetar(x.datos)) : [];
    } catch {
      return [];
    }
  };
  const llenarPresets = async (elegido = "") => {
    enCaja = await leerCaja();
    const opcion = (valor, texto) => {
      const o = el("option", "", texto);
      o.value = valor;
      return o;
    };
    const fab = el("optgroup");
    fab.label = t("De f\xE1brica");
    FABRICA.forEach((P, i) => fab.append(opcion(`f${i}`, t(P.nombre))));
    const grupos = [opcion("", `\u2014 ${t("Preset")} \u2014`), fab];
    if (typeof pz.presets === "function") {
      const caja2 = el("optgroup");
      caja2.label = t("En la caja");
      for (const x of enCaja) caja2.append(opcion(`c:${x.nombre}`, x.nombre));
      grupos.push(caja2);
    }
    const propios = el("optgroup");
    propios.label = t("En este navegador");
    for (const x of leerPropios()) propios.append(opcion(`p:${x.nombre}`, x.nombre));
    grupos.push(propios);
    selPreset.replaceChildren(...grupos);
    selPreset.value = elegido;
  };
  const aplicar = async (estado) => {
    const base = estadoDeFabrica({ inst: estado.inst || { zonas: [] } }, N.PARAMS);
    await nodo.setState({ ...estado, parameterValues: { ...base.parameterValues, ...estado.parameterValues || {} }, inst: estado.inst || base.inst });
  };
  selPreset.addEventListener("change", () => {
    const val = selPreset.value;
    if (!val) return;
    if (val.startsWith("f")) {
      const P = FABRICA[Number(val.slice(1))];
      if (P) void aplicar(estadoDeFabrica(P, N.PARAMS));
      nombrePreset.value = "";
    } else if (val.startsWith("c:")) {
      const x = enCaja.find((y) => `c:${y.nombre}` === val);
      const d = x && desempaquetar(x.datos);
      if (d) void aplicar(d.estado);
      nombrePreset.value = x ? x.nombre : "";
    } else {
      const x = leerPropios().find((y) => `p:${y.nombre}` === val);
      if (x) void aplicar(x.estado);
      nombrePreset.value = x ? x.nombre : "";
    }
  });
  const estadoActual = async () => {
    const e = await nodo.getState();
    const n = sinDireccion(nodo);
    if (n) avisar(t("Los audios abiertos desde el computador no quedan en el preset"));
    return e;
  };
  const nombreOAvisar = () => {
    const nombre = nombrePreset.value.trim();
    if (!nombre) {
      nombrePreset.focus();
      avisar(t("Falta el nombre del preset"));
    }
    return nombre;
  };
  const enLaCaja = typeof pz.guardarPreset === "function";
  const botonGuardar = boton(t(enLaCaja ? "Guardar en la caja" : "Guardar"), async () => {
    const nombre = nombreOAvisar();
    if (!nombre) return;
    if (enLaCaja) {
      const r = await pz.guardarPreset({ nombre, datos: empaquetar(nombre, await estadoActual()) });
      if (r === false) return avisar(t("No se pudo guardar en la caja"));
      await llenarPresets(`c:${nombre}`);
      if (!avisoPreset.textContent) avisar(t("Guardado en la caja"));
      return;
    }
    const ok = guardarPropio(nombre, await estadoActual());
    await llenarPresets(`p:${nombre}`);
    if (!ok) avisar(t("Este navegador no deja guardar"));
    else if (!avisoPreset.textContent) avisar(t("Guardado en este navegador"));
  });
  const botonNavegador = enLaCaja ? boton(t("En este navegador"), async () => {
    const nombre = nombreOAvisar();
    if (!nombre) return;
    const ok = guardarPropio(nombre, await estadoActual());
    await llenarPresets(`p:${nombre}`);
    if (!ok) avisar(t("Este navegador no deja guardar"));
    else if (!avisoPreset.textContent) avisar(t("Guardado en este navegador"));
  }) : null;
  const botonBorrar = boton(t("Borrar"), async () => {
    const val = selPreset.value;
    if (val.startsWith("p:")) borrarPropio(val.slice(2));
    else if (val.startsWith("c:") && typeof pz.borrarPreset === "function") await pz.borrarPreset(val.slice(2));
    else return;
    await llenarPresets();
    nombrePreset.value = "";
  });
  const botonBajar = boton(t("Bajar archivo"), async () => {
    const nombre = nombrePreset.value.trim() || t("Sampler");
    const blob = new Blob([JSON.stringify(empaquetar(nombre, await estadoActual()), null, 1)], { type: "application/json" });
    const a = el("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${nombre.replace(/[\\/:*?"<>|]+/g, "_")}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2e3);
  });
  const subida = el("input");
  subida.type = "file";
  subida.accept = ".json,application/json";
  subida.style.display = "none";
  subida.addEventListener("change", async () => {
    const f = subida.files && subida.files[0];
    subida.value = "";
    if (!f) return;
    let d = null;
    try {
      d = desempaquetar(JSON.parse(await f.text()));
    } catch {
      d = null;
    }
    if (!d) return avisar(t("Ese archivo no es un preset del sampler"));
    await aplicar(d.estado);
    nombrePreset.value = d.nombre;
    selPreset.value = "";
  });
  const botonSubir = boton(t("Subir archivo"), () => subida.click());
  filaPresets.append(selPreset, nombrePreset, botonGuardar, botonBorrar, botonBajar, botonSubir, subida);
  if (botonNavegador) botonGuardar.after(botonNavegador);
  filaPresets.append(avisoPreset);
  void llenarPresets();
  const tec = lienzo(536, 52);
  tec.c.style.cursor = "pointer";
  const marcoTec = el("div", "padding:8px 10px 4px;");
  marcoTec.append(tec.c);
  const anchoTecla = 536 / (NOTA_ALTA - NOTA_BAJA + 1);
  const xNota = (n) => (n - NOTA_BAJA) * anchoTecla;
  const notaEn = (x) => entre(Math.floor(x / anchoTecla) + NOTA_BAJA, NOTA_BAJA, NOTA_ALTA);
  tec.c.addEventListener("pointerdown", (ev) => {
    const r = tec.c.getBoundingClientRect();
    const n = notaEn((ev.clientX - r.left) * 536 / r.width);
    const i = inst.zonas.findIndex((z) => n >= z.baja && n <= z.alta);
    if (i >= 0) {
      zSel = i;
      cSel = 0;
      pintarTodo();
    }
  });
  const filaZona = el("div", `display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;padding:4px 10px 6px;border-bottom:1px solid ${v("borde")};`);
  const titZona = el("span", "font-weight:bold;");
  const fmtNota = (x) => nombreNota(Math.round(x));
  const cBaja = casilla({ nombre: t("Desde"), min: 0, max: 127, paso: 1, porDefecto: 36, formato: fmtNota, alCambiar: (x) => ponerZona({ baja: Math.round(x) }) });
  const cAlta = casilla({ nombre: t("Hasta"), min: 0, max: 127, paso: 1, porDefecto: 36, formato: fmtNota, alCambiar: (x) => ponerZona({ alta: Math.round(x) }) });
  const cRaiz = casilla({ nombre: t("Ra\xEDz"), min: 0, max: 127, paso: 1, porDefecto: 60, formato: fmtNota, alCambiar: (x) => ponerZona({ raiz: Math.round(x) }) });
  const iGolpe = interruptor({ nombre: t("Golpe (bater\xEDa)"), porDefecto: false, alCambiar: (si) => ponerZona({ golpe: si }) });
  const etiqueta = (texto, control) => {
    const s = el("span", "display:inline-flex;align-items:center;gap:4px;");
    s.append(el("span", `color:${v("tinta2")};`, texto), control);
    return s;
  };
  const zonaNueva = (golpe, tajadas = false) => {
    const ocupada = (n) => inst.zonas.some((z2) => n >= z2.baja && n <= z2.alta);
    let z;
    if (tajadas) {
      let n = 48;
      while (n < 127 && ocupada(n)) n++;
      z = { baja: n, alta: n, raiz: n, golpe: true, tajadas: true, sens: 50, capas: [{}] };
    } else if (golpe) {
      let n = 36;
      while (n < 127 && ocupada(n)) n++;
      z = { baja: n, alta: n, raiz: n, golpe: true, capas: [{}] };
    } else {
      let a = NOTA_BAJA;
      while (a < NOTA_ALTA && ocupada(a)) a++;
      let b = a;
      while (b < NOTA_ALTA && !ocupada(b + 1)) b++;
      z = { baja: a, alta: b, raiz: entre(60, a, b), golpe: false, capas: [{}] };
    }
    inst.zonas.push(z);
    zSel = inst.zonas.length - 1;
    cSel = 0;
    guardar();
    pintarTodo();
  };
  const borrarZona = () => {
    if (zSel < 0) return;
    inst.zonas.splice(zSel, 1);
    zSel = Math.min(zSel, inst.zonas.length - 1);
    cSel = 0;
    guardar();
    pintarTodo();
  };
  filaZona.append(
    titZona,
    etiqueta(t("Desde"), cBaja.el),
    etiqueta(t("Hasta"), cAlta.el),
    etiqueta(t("Ra\xEDz"), cRaiz.el),
    iGolpe.el,
    boton(`+ ${t("Piano")}`, () => zonaNueva(false), t("Nueva zona de piano")),
    boton(`+ ${t("Bater\xEDa")}`, () => zonaNueva(true), t("Nueva zona de bater\xEDa")),
    boton(`+ ${t("Tajadas")}`, () => zonaNueva(true, true), t("Nueva zona de tajadas")),
    boton("\xD7", borrarZona, t("Borrar zona"))
  );
  const ponerZona = (campos) => {
    const z = zona();
    if (!z) return;
    Object.assign(z, campos);
    if (z.alta < z.baja) [z.baja, z.alta] = [z.alta, z.baja];
    ajustarTajadas(z);
    guardar();
    pintarTodo();
  };
  const ajustarTajadas = (z) => {
    if (!z || !z.tajadas) return;
    let n = 1;
    for (const c of z.capas) if (Array.isArray(c.cortes)) n = Math.max(n, c.cortes.length);
    z.alta = Math.min(127, z.baja + n - 1);
    z.raiz = z.baja;
    z.golpe = true;
  };
  const ponerCortes = (cortes) => {
    const z = zona();
    const c = capa();
    if (!z || !c) return;
    c.cortes = cortes.length ? cortes.map((x) => Math.round(x * 1e4) / 1e4) : [0];
    ajustarTajadas(z);
    guardar();
    pintarTodo();
  };
  const detectar = () => {
    const z = zona();
    const c = capa();
    if (z && c && durDe()) ponerCortes(nodo.detectarGolpes(c.m, z.sens === void 0 ? 50 : z.sens));
  };
  const filaCapas = el("div", "display:flex;align-items:center;gap:6px;padding:6px 10px 2px;");
  const botonesCapa = [0, 1, 2].map((k) => {
    const b = boton(`${t("Capa")} ${k + 1}`, () => {
      const z = zona();
      if (!z) return;
      if (!z.capas[k]) {
        while (z.capas.length <= k) z.capas.push({});
        guardar();
      }
      cSel = k;
      pintarTodo();
    });
    return b;
  });
  const nombreAudio = el("span", `flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:${v("tinta2")};`);
  const archivo = el("input");
  archivo.type = "file";
  archivo.accept = "audio/*";
  archivo.style.display = "none";
  archivo.addEventListener("change", async () => {
    const f = archivo.files && archivo.files[0];
    archivo.value = "";
    if (!f || !capa()) return;
    const m = await nodo.cargarArchivo(f);
    ponerAudio(m);
  });
  const quitarCapa = () => {
    const z = zona();
    if (!z || z.capas.length <= 1) return;
    z.capas.splice(cSel, 1);
    cSel = Math.max(0, cSel - 1);
    guardar();
    pintarTodo();
  };
  const selFuente = elegidor({
    nombre: t("Fuente"),
    opciones: [t("Audio"), t("Oscilador"), t("Soplo")],
    alCambiar: (i) => {
      const c = capa();
      if (!c) return;
      if (i === 1) c.osc = c.osc || { forma: 2, ancho: 50 };
      else delete c.osc;
      if (i === 2) c.mod = c.mod || {};
      else delete c.mod;
      guardar();
      pintarTodo();
    }
  });
  const botonAbrir = boton(t("Abrir archivo"), () => archivo.click());
  const elegirDeAnfitrion = nodo.pz && typeof nodo.pz.elegirAudio === "function" ? nodo.pz.elegirAudio : null;
  const botonPz = boton(t("Desde Pizarrita"), async () => {
    if (!capa() || !elegirDeAnfitrion) return;
    const r = await elegirDeAnfitrion();
    if (!r || !r.url || !capa()) return;
    const m = await nodo.cargarDireccion(r.url, r.nombre);
    ponerAudio(m);
  });
  if (!elegirDeAnfitrion) botonPz.style.display = "none";
  filaCapas.append(selFuente.el, nombreAudio, botonPz, botonAbrir, archivo, boton("\xD7", quitarCapa, t("Quitar capa")));
  const filaDir = el("div", "display:flex;align-items:center;gap:6px;padding:2px 10px 4px;");
  const dir = el("input", `flex:1;min-width:0;font:inherit;font-size:11px;color:${v("tinta")};background:${v("pantalla")};border:1px solid ${v("borde")};padding:1px 4px;`);
  dir.placeholder = t("Direcci\xF3n web del audio");
  const cargarDir = async () => {
    const url = dir.value.trim();
    if (!url || !capa()) return;
    const m = await nodo.cargarDireccion(url);
    dir.value = "";
    ponerAudio(m);
  };
  dir.addEventListener("keydown", (ev) => {
    ev.stopPropagation();
    if (ev.key === "Enter") void cargarDir();
  });
  filaDir.append(dir, boton(t("Cargar"), () => void cargarDir()));
  const ponerAudio = (m) => {
    const c = capa();
    if (!c) return;
    const viejo = c.m;
    Object.assign(c, { m, ini: 0, lIni: void 0, lFin: void 0, fin: void 0, cortes: void 0 });
    if (viejo && !inst.zonas.some((z) => z.capas.some((x) => x.m === viejo))) nodo.quitarMuestra(viejo);
    guardar();
    pintarTodo();
  };
  const onda = lienzo(536, 110);
  const marcoOnda = el("div", "padding:2px 10px 4px;");
  marcoOnda.append(onda.c);
  const MARCAS = ["ini", "lIni", "lFin", "fin"];
  let tomada = null;
  const durDe = () => {
    const c = capa();
    if (c && (c.osc || c.mod)) return 0;
    const mu = c && nodo.muestras[c.m];
    return mu && mu.estado === "lista" ? mu.dur : 0;
  };
  const marcaDe = (c, k, dur) => {
    if (k === "ini") return c.ini || 0;
    if (k === "fin") return c.fin === void 0 || c.fin === null ? dur : c.fin;
    if (k === "lIni") return c.lIni === void 0 || c.lIni === null ? marcaDe(c, "ini", dur) : c.lIni;
    return c.lFin === void 0 || c.lFin === null ? marcaDe(c, "fin", dur) : c.lFin;
  };
  const xDe = (s, dur) => dur > 0 ? s / dur * 536 : 0;
  const enTajadas = () => !!(zona() && zona().tajadas);
  const cortesDe = (c) => Array.isArray(c.cortes) ? c.cortes : [];
  const marcasDe = (c, dur) => enTajadas() ? [...cortesDe(c).map((s, i) => ({ k: `c${i}`, s })), { k: "fin", s: marcaDe(c, "fin", dur) }] : MARCAS.filter((k) => c.loop || k !== "lIni" && k !== "lFin").map((k) => ({ k, s: marcaDe(c, k, dur) }));
  const segDe = (ev, dur) => {
    const r = onda.c.getBoundingClientRect();
    return entre((ev.clientX - r.left) * 536 / r.width / 536 * dur, 0, dur);
  };
  const marcaCerca = (c, dur, x) => {
    let mejor = null;
    let dist = 7;
    for (const mk of marcasDe(c, dur)) {
      const d = Math.abs(xDe(mk.s, dur) - x);
      if (d < dist) {
        dist = d;
        mejor = mk.k;
      }
    }
    return mejor;
  };
  const tajadaEn = (c, s, dur) => {
    const cs = cortesDe(c);
    if (s >= marcaDe(c, "fin", dur)) return -1;
    let i = -1;
    for (let k = 0; k < cs.length; k++) if (cs[k] <= s) i = k;
    return i;
  };
  onda.c.addEventListener("pointerdown", (ev) => {
    const c = capa();
    const dur = durDe();
    if (!c || !dur) return;
    const s = segDe(ev, dur);
    const mejor = marcaCerca(c, dur, xDe(s, dur));
    if (!mejor) {
      if (enTajadas()) {
        const i = tajadaEn(c, s, dur);
        if (i >= 0) nodo.tocar(zona().baja + i);
      }
      return;
    }
    tomada = mejor;
    try {
      onda.c.setPointerCapture(ev.pointerId);
    } catch (e) {
    }
  });
  onda.c.addEventListener("pointermove", (ev) => {
    const c = capa();
    const dur = durDe();
    if (!tomada || !c || !dur) return;
    const s = segDe(ev, dur);
    if (enTajadas()) {
      const cs = cortesDe(c);
      if (tomada === "fin") {
        c.fin = Math.round(entre(s, cs.length ? cs[cs.length - 1] + 5e-3 : 0, dur) * 1e4) / 1e4;
      } else {
        const i = Number(tomada.slice(1));
        const lo2 = i > 0 ? cs[i - 1] + 5e-3 : 0;
        const hi2 = i + 1 < cs.length ? cs[i + 1] - 5e-3 : marcaDe(c, "fin", dur) - 5e-3;
        cs[i] = Math.round(entre(s, lo2, Math.max(lo2, hi2)) * 1e4) / 1e4;
      }
      pintarOnda();
      return;
    }
    const orden = MARCAS.indexOf(tomada);
    const lo = orden > 0 ? marcaDe(c, MARCAS[orden - 1], dur) : 0;
    const hi = orden < 3 ? marcaDe(c, MARCAS[orden + 1], dur) : dur;
    c[tomada] = Math.round(entre(s, lo, hi) * 1e4) / 1e4;
    pintarOnda();
  });
  onda.c.addEventListener("dblclick", (ev) => {
    const c = capa();
    const dur = durDe();
    if (!c || !dur || !enTajadas()) return;
    const s = segDe(ev, dur);
    const k = marcaCerca(c, dur, xDe(s, dur));
    const cs = cortesDe(c).slice();
    if (k && k !== "fin") {
      if (cs.length <= 1) return;
      cs.splice(Number(k.slice(1)), 1);
    } else if (!k && s < marcaDe(c, "fin", dur)) {
      cs.push(s);
      cs.sort((x, y) => x - y);
    } else return;
    ponerCortes(cs);
  });
  const soltarMarca = () => {
    if (!tomada) return;
    tomada = null;
    guardar();
  };
  onda.c.addEventListener("pointerup", soltarMarca);
  onda.c.addEventListener("pointercancel", soltarMarca);
  const filaCapa = el("div", "display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;padding:2px 10px 6px;");
  const ponerCapa = (campos) => {
    const c = capa();
    if (!c) return;
    Object.assign(c, campos);
    guardar();
    pintarOnda();
    pintarEstirar();
  };
  const iLoop = interruptor({ nombre: t("Loop"), porDefecto: false, alCambiar: (si) => ponerCapa({ loop: si }) });
  const altura = (k) => interruptor({
    nombre: [t("Entrada"), t("Loop"), t("Release")][k],
    porDefecto: true,
    alCambiar: (si) => {
      const c = capa();
      if (!c) return;
      const alt = Array.isArray(c.alt) ? c.alt.slice() : [true, true, true];
      alt[k] = si;
      ponerCapa({ alt });
    }
  });
  const iAlt = [altura(0), altura(1), altura(2)];
  const pGan = perilla({ nombre: t("Volumen"), min: -40, max: 12, paso: 0.5, porDefecto: 0, formato: (x) => `${numero(x, 1)} dB`, alCambiar: (x) => ponerCapa({ gan: x }) });
  const pPan = perilla({ nombre: t("Paneo"), min: -1, max: 1, paso: 0.01, porDefecto: 0, formato: (x) => Math.abs(x) < 5e-3 ? "C" : `${x < 0 ? "I" : "D"} ${Math.round(Math.abs(x) * 100)}`, alCambiar: (x) => ponerCapa({ pan: x }) });
  const pAfin = perilla({ nombre: t("Afinaci\xF3n"), min: -24, max: 24, paso: 0.01, porDefecto: 0, formato: (x) => `${numero(x, 2)} st`, alCambiar: (x) => ponerCapa({ afinar: x }) });
  const altCaja = el("span", "display:inline-flex;align-items:center;gap:16px;");
  altCaja.append(el("span", `color:${v("tinta2")};`, t("Con la altura de la nota:")), ...iAlt.map((x) => x.el));
  const perillasCapa = el("span", "display:inline-flex;gap:10px;margin-left:auto;");
  perillasCapa.append(pGan.el, pPan.el, pAfin.el);
  const ponerOsc = (campos) => {
    const c = capa();
    if (!c || !c.osc) return;
    c.osc = { ...c.osc, ...campos };
    guardar();
    pintarTodo();
  };
  const selForma = elegidor({ nombre: t("Forma"), opciones: [t("Seno"), t("Tri\xE1ngulo"), t("Sierra"), t("Cuadrada")], alCambiar: (i) => ponerOsc({ forma: i }) });
  const pAncho = perilla({ nombre: t("Ancho"), min: 5, max: 95, paso: 1, porDefecto: 50, formato: (x) => `${Math.round(x)} %`, alCambiar: (x) => ponerOsc({ ancho: Math.round(x) }) });
  const oscCaja = el("span", "display:inline-flex;align-items:center;gap:10px;");
  const formaCaja = el("span", "display:inline-flex;align-items:center;gap:4px;");
  formaCaja.append(el("span", `color:${v("tinta2")};`, t("Forma")), selForma.el);
  oscCaja.append(formaCaja, pAncho.el);
  filaCapa.append(iLoop.el, altCaja, oscCaja, perillasCapa);
  const filaEstirar = el("div", `display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;padding:0 10px 8px;border-bottom:1px solid ${v("borde")};`);
  const titEstirar = el("span", `color:${v("tinta2")};`);
  const largoParte = (c, k) => {
    const dur = durDe();
    if (!c || !dur) return 0;
    if (enTajadas()) {
      const cs = cortesDe(c);
      return marcaDe(c, "fin", dur) - (cs.length ? cs[0] : 0);
    }
    if (!c.loop) return marcaDe(c, "fin", dur) - marcaDe(c, "ini", dur);
    const m = ["ini", "lIni", "lFin", "fin"].map((x) => marcaDe(c, x, dur));
    return m[k + 1] - m[k];
  };
  const ponerEst = (k, e) => {
    const c = capa();
    if (!c) return;
    const est = Array.isArray(c.est) ? c.est.slice(0, 3) : [];
    while (est.length < 3) est.push(null);
    est[k] = e;
    c.est = est;
    guardar();
  };
  const estiradores = [0, 1, 2].map((k) => {
    const caja2 = el("span", "display:inline-flex;align-items:center;gap:4px;");
    const rotulo = el("span", `color:${v("tinta2")};`, [t("Entrada"), t("Loop"), t("Release")][k]);
    const cMs = casilla({ nombre: t("Milisegundos"), min: 1, max: 2e4, paso: 1, porDefecto: 500, formato: (x) => `${Math.round(x)} ms`, alCambiar: (x) => ponerEst(k, { u: "ms", v: Math.round(x) }) });
    const cT = casilla({ nombre: t("Tiempos"), min: 0.25, max: 64, paso: 0.25, porDefecto: 1, formato: (x) => `${numero(x, 2)} \u2669`, alCambiar: (x) => ponerEst(k, { u: "t", v: Math.round(x * 4) / 4 }) });
    const sel = elegidor({
      nombre: t("Estirar al tempo"),
      opciones: [t("Sin estirar"), t("Milisegundos"), t("Tiempos")],
      alCambiar: (i) => {
        const s = largoParte(capa(), k);
        if (i === 0) ponerEst(k, null);
        else if (i === 1) ponerEst(k, { u: "ms", v: Math.max(1, Math.round(s * 1e3)) });
        else ponerEst(k, { u: "t", v: Math.max(0.25, Math.round(s * nodo.bpm / 60 * 4) / 4) });
        pintarEstirar();
      }
    });
    caja2.append(rotulo, sel.el, cMs.el, cT.el);
    return { el: caja2, rotulo, sel, cMs, cT };
  });
  filaEstirar.append(titEstirar, ...estiradores.map((x) => x.el));
  const pintarEstirar = () => {
    const c = capa();
    titEstirar.textContent = `${t("Estirar al tempo")} (${numero(nodo.bpm, 0)} bpm):`;
    filaEstirar.style.display = c && (c.osc || c.mod) ? "none" : "flex";
    filaEstirar.style.opacity = c && durDe() ? "" : "0.4";
    const partes2 = !c || enTajadas() || !c.loop ? 1 : 3;
    estiradores.forEach((x, k) => {
      x.el.style.display = k < partes2 ? "inline-flex" : "none";
      x.rotulo.style.display = partes2 > 1 ? "" : "none";
      const e = c && Array.isArray(c.est) ? c.est[k] : null;
      const i = e && Number(e.v) > 0 ? e.u === "t" ? 2 : 1 : 0;
      x.sel.poner(i);
      x.cMs.el.style.display = i === 1 ? "" : "none";
      x.cT.el.style.display = i === 2 ? "" : "none";
      if (i === 1) x.cMs.poner(Number(e.v));
      if (i === 2) x.cT.poner(Number(e.v));
    });
  };
  const filaTajadas = el("div", "display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;padding:2px 10px 6px;");
  const pSens = perilla({
    nombre: t("Sensibilidad"),
    min: 0,
    max: 100,
    paso: 1,
    porDefecto: 50,
    formato: (x) => `${Math.round(x)} %`,
    alCambiar: (x) => {
      const z = zona();
      if (z) z.sens = Math.round(x);
    }
  });
  let partes = 16;
  const cPartes = casilla({ nombre: t("Partes"), min: 1, max: 64, paso: 1, porDefecto: 16, formato: (x) => String(Math.round(x)), alCambiar: (x) => partes = Math.round(x) });
  filaTajadas.append(
    boton(t("Detectar"), detectar, t("Detectar los golpes")),
    pSens.el,
    el("span", `color:${v("tinta2")};margin-left:8px;`, t("Partes")),
    cPartes.el,
    boton(t("Partes iguales"), () => {
      const c = capa();
      const dur = durDe();
      if (c && dur) ponerCortes(parejos(marcaDe(c, "fin", dur), partes));
    }),
    el("span", `margin-left:auto;color:${v("tinta2")};font-size:11px;`, t("Clic: o\xEDr la tajada \xB7 doble clic: agregar o quitar un corte"))
  );
  const moldeado = crearMoldeado(nodo, N, () => coloresDe(caja));
  moldeado.iniciar();
  const GRUPOS = [
    ["general", "General"],
    ["color", "Color"],
    ["v1", "Vaiv\xE9n 1"],
    ["v2", "Vaiv\xE9n 2"]
  ];
  const textoDe = (p, x) => `${numero(x, p.dec !== void 0 ? p.dec : 0)}${p.unidad ? ` ${p.unidad}` : ""}`;
  const mandar = (id, x) => void nodo.setParameterValues({ [id]: { id, value: x, normalized: false } });
  const generales = {};
  const hojas = {};
  for (const [g, titulo2] of GRUPOS) {
    const ps = N.PARAMS.filter((p) => p.grupo === g);
    const lugares = Math.max(6, ps.reduce((n, p) => n + (p.tipo === "choice" ? 2 : 1), 0));
    const hoja = el("div", `display:grid;grid-template-columns:repeat(${lugares},minmax(0,1fr));gap:4px;align-items:start;`);
    for (const p of ps) {
      const nombre = t(p.corto || p.nombre);
      if (p.tipo === "choice") {
        const c = elegidor({ nombre, opciones: p.opciones.map((x) => t(x)), alCambiar: (i) => mandar(p.id, i) });
        c.poner(p.defecto);
        const celda = el("div", "display:flex;flex-direction:column;align-items:center;gap:6px;min-width:0;grid-column:span 2;");
        celda.append(el("div", `color:${v("tinta2")};font-size:11px;white-space:nowrap;`, nombre), c.el);
        generales[p.id] = { ...c, poner: (x) => c.poner(Math.round(x)) };
        hoja.append(celda);
      } else {
        const c = perilla({
          nombre,
          min: p.min,
          max: p.max,
          paso: p.paso || 1,
          log: !!p.log,
          porDefecto: p.defecto,
          formato: (x) => textoDe(p, x),
          alCambiar: (x) => mandar(p.id, x)
        });
        generales[p.id] = c;
        hoja.append(c.el);
      }
    }
    hojas[g] = hoja;
  }
  const titulo = (texto) => el("div", `color:${v("tinta2")};font-size:11px;margin:8px 0 2px;`, texto);
  const marco = (...hijos) => {
    const m = el("div", "padding:4px 10px 10px;");
    m.append(...hijos);
    return m;
  };
  const filaCapaFuente = el("div", "padding:4px 10px 10px;");
  const MATERIALES = [
    ["Ca\xF1er\xEDa de gas", { sdc: 10 }],
    ["Ca\xF1er\xEDa de agua", { sdc: 20 }],
    ["Cacho de cabra", { slh: 18, sdh: 45, sfh: 60 }],
    ["Cacho de vaca", { slh: 35, sdh: 90, sfh: 50 }],
    // (2026-11-26) el ñolkiñ de tallo de Senecio otites y cono de hoja: pared blanda y rugosa
    // (más pérdida, más cálido) y un cono recto; medidas estimadas
    ["Tallo de \xF1olki\xF1", { sdc: 20, spa: 30 }],
    ["Cono de hoja", { slh: 20, sdh: 80, sfh: 0, scb: 50 }]
  ];
  const LARGOS = [
    ["Largo 1,5 m", 150],
    ["Largo 2 m", 200]
  ];
  const filaMateriales = el("div", "display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:4px;");
  filaMateriales.append(el("span", `color:${v("tinta2")};font-size:11px;`, t("Materiales:")));
  for (const [nombre, vals] of MATERIALES)
    filaMateriales.append(
      boton(t(nombre), () => {
        const k = cSel + 1;
        const cambios = { sgm: 1, smt: 1, ...vals };
        const pv = {};
        for (const [c, x] of Object.entries(cambios)) pv[`c${k}${c}`] = { id: `c${k}${c}`, value: x, normalized: false };
        void nodo.setParameterValues(pv);
      })
    );
  for (const [nombre, total] of LARGOS)
    filaMateriales.append(
      boton(t(nombre), () => {
        const k = cSel + 1;
        void nodo.getParameterValues(false).then((vals) => {
          const cacho = vals[`c${k}slh`]?.value ?? 0;
          const pv = {};
          for (const [c, x] of Object.entries({ sgm: 1, smt: 1, slm: 1, slc: Math.max(5, total - cacho) })) pv[`c${k}${c}`] = { id: `c${k}${c}`, value: x, normalized: false };
          void nodo.setParameterValues(pv);
        });
      })
    );
  filaCapaFuente.append(titulo(t("Capa")), moldeado.crearGrupo(["niv", "afi", "ret"]));
  const ayuda = el("div", `padding:6px 10px 0;color:${v("tinta2")};font-size:11px;`, t("Clic en el teclado: elegir la zona \xB7 arrastrar las marcas: d\xF3nde parte, el loop y el fin"));
  const CARPETAS = [
    ["facil", "F\xE1cil", () => [marco(hojas.general, titulo(t("Filtro")), moldeado.crearGrupo(["ft", "fc", "fr", "fi"]))]],
    ["fuente", "Fuente", () => [ayuda, marcoTec, filaZona, filaCapas, filaDir, marcoOnda, filaTajadas, filaCapa, filaEstirar, filaCapaFuente]],
    ["soplo", "Soplo", () => [marco(el("div", `color:${v("tinta2")};font-size:11px;`, t("Para una capa con la fuente \xABSoplo\xBB: el modelo del tubo y c\xF3mo se toca. La envolvente de Volumen es el soplo.")), titulo(t("Tubo")), moldeado.crearGrupo(["smt", "sex", "sfo", "stb", "stn", "stf"]), titulo(t("Medidas del tubo")), moldeado.crearGrupo(["sgm", "slm", "slc", "sdc", "ssn"]), moldeado.crearGrupo(["slh", "sdh", "sfh", "spa", "scb", "sen", "svu"]), moldeado.crearGrupo(["slb", "sbq", "sbv", "sbg", "sbr"]), filaMateriales, titulo(t("Interpretaci\xF3n")), moldeado.crearGrupo(["sai", "sem", "sru", "ssu", "ssa", "sas", "sgr"]), moldeado.crearGrupo(["slg", "slt", "sgl", "srs", "svn"]), moldeado.crearGrupo(["sgi", "sap", "sca", "stc", "sdf", "sde", "sfa"]), moldeado.crearGrupo(["sbo", "sf1", "sf2"]), titulo(t("Desv\xEDo de la nota")), moldeado.crearGrupo(["sds", "sdt", "sdx", "sin", "siv"]))]],
    ["filtro", "Filtro", () => (moldeado.ponerHoja("fil"), [moldeado.el])],
    ["volumen", "Volumen", () => (moldeado.ponerHoja("vol"), [moldeado.el])],
    ["altura", "Altura", () => (moldeado.ponerHoja("alt"), [moldeado.el])],
    ["control", "Control", () => [marco(titulo(t("Vaiv\xE9n 1")), hojas.v1, titulo(t("Vaiv\xE9n 2")), hojas.v2)]],
    ["efectos", "Efectos", () => [marco(hojas.color, titulo(`${t("Capa")}: ${t("Realce de arm\xF3nicos")}`), moldeado.crearGrupo(["mhm", "mhi", "mhz"]), titulo(`${t("Capa")}: ${t("Resonador")}`), moldeado.crearGrupo(["mrm", "mrf", "mrz"]), titulo(`${t("Capa")}: ${t("Cuerpo")}`), moldeado.crearGrupo(["mcm", "mct", "mcy"]))]]
  ];
  const contenidos = {};
  const paginas = el("div", "height:450px;overflow-y:auto;overflow-x:hidden;scrollbar-width:thin;");
  let carpeta = "fuente";
  const botonesCarpeta = {};
  for (const [k, nombre, armar] of CARPETAS) {
    const b = boton(t(nombre), () => ponerCarpeta(k));
    b.style.padding = "1px 4px";
    botonesCarpeta[k] = { b, armar };
    cabecera.append(b);
  }
  cabecera.append(el("span", "flex:1;"), el("span", `color:${v("tinta2")};margin-right:2px;`, t("Capa")), ...botonesCapa);
  for (const b of botonesCapa) b.textContent = b.textContent.replace(/^.* (\d)$/, "$1");
  for (const b of botonesCapa) b.style.padding = "1px 5px";
  const ponerCarpeta = (k) => {
    carpeta = k;
    const c = botonesCarpeta[k];
    if (!contenidos[k] || ["filtro", "volumen", "altura"].includes(k)) contenidos[k] = c.armar();
    paginas.replaceChildren(...contenidos[k]);
    paginas.scrollTop = 0;
    for (const [kk, x] of Object.entries(botonesCarpeta)) {
      x.b.style.fontWeight = kk === carpeta ? "bold" : "";
      x.b.style.background = kk === carpeta ? v("acento") : v("pantalla");
    }
  };
  ponerCarpeta("fuente");
  caja.append(filaPresets, cabecera, paginas);
  let C = coloresDe(caja);
  const pintarTeclado = () => {
    const g = tec.g;
    g.fillStyle = C.pantalla;
    g.fillRect(0, 0, 536, 52);
    inst.zonas.forEach((z, i) => {
      const x0 = xNota(Math.max(NOTA_BAJA, z.baja));
      const x1 = xNota(Math.min(NOTA_ALTA, z.alta) + 1);
      if (x1 <= x0) return;
      g.fillStyle = C.acento;
      g.globalAlpha = i === zSel ? 0.9 : 0.4;
      g.fillRect(x0 + 0.5, 1, x1 - x0 - 1, 14);
      g.globalAlpha = 1;
      if (z.raiz >= NOTA_BAJA && z.raiz <= NOTA_ALTA) {
        g.fillStyle = C.tinta;
        g.fillRect(xNota(z.raiz) + anchoTecla / 2 - 1, 3, 2, 10);
      }
    });
    for (let n = NOTA_BAJA; n <= NOTA_ALTA; n++) {
      g.fillStyle = negra(n) ? C.tinta2 : C.fondo;
      g.fillRect(xNota(n) + 0.5, 18, anchoTecla - 1, negra(n) ? 22 : 33);
    }
    g.fillStyle = C.tinta2;
    g.font = "9px system-ui, sans-serif";
    g.textAlign = "left";
    for (let n = 36; n <= NOTA_ALTA; n += 12) {
      const ultimo = xNota(n) + 24 > 536;
      g.textAlign = ultimo ? "right" : "left";
      g.fillText(nombreNota(n), ultimo ? 535 : xNota(n) + 1, 50);
    }
  };
  const pintarOnda = () => {
    const g = onda.g;
    g.fillStyle = C.pantalla;
    g.fillRect(0, 0, 536, 110);
    g.strokeStyle = C.borde;
    g.strokeRect(0.5, 0.5, 535, 109);
    const c = capa();
    const mu = c && nodo.muestras[c.m];
    g.fillStyle = C.tinta2;
    g.font = "11px system-ui, sans-serif";
    g.textAlign = "center";
    if (!zona()) {
      g.fillText(t("Sin zonas: crear una de piano o de bater\xEDa"), 268, 58);
      return;
    }
    if (c && c.mod) {
      const k = cSel + 1;
      const val = (corto, d) => {
        const p = N.PARAMS.find((q) => q.id === `c${k}${corto}`);
        const x = moldeado.valor(`c${k}${corto}`);
        return x !== void 0 ? x : p ? p.defecto : d;
      };
      const modelo = Math.round(val("smt", 0));
      if (modelo === 1 && val("sgm", 0) >= 0.5) {
        dibujarTuboMedido(g, val, k);
        return;
      }
      g.strokeStyle = C.tinta;
      g.lineWidth = 2;
      g.strokeRect(70, 45, 380, 22);
      g.fillStyle = C.acento;
      if (modelo === 1) {
        g.beginPath();
        g.moveTo(450, 45);
        g.lineTo(500, 20);
        g.moveTo(450, 67);
        g.lineTo(500, 92);
        g.stroke();
      } else if (val("sex", 0) >= 0.5 && modelo === 0) g.fillRect(446, 45, 6, 22);
      g.fillRect(48, 49, 22, 14);
      g.lineWidth = 1;
      g.fillStyle = C.tinta2;
      g.font = "11px system-ui, sans-serif";
      g.textAlign = "center";
      g.fillText(`${t("Soplo")}: ${t(N.MODELOS[modelo] || "")}`, 268, 104);
      return;
    }
    if (c && c.osc) {
      const forma = Math.round(Number(c.osc.forma) || 0);
      const w = (Number(c.osc.ancho) || 50) / 100;
      const y = (ph) => forma === 0 ? Math.sin(2 * Math.PI * ph) : forma === 1 ? 1 - 4 * Math.abs(ph - 0.5) : forma === 2 ? 2 * ph - 1 : ph < w ? 1 : -1;
      g.strokeStyle = C.tinta;
      g.lineWidth = 1.5;
      g.beginPath();
      for (let x = 0; x <= 536; x++) {
        const ph = (x / 268 % 1 + 1) % 1;
        const yy = 55 - y(ph) * 40;
        if (x === 0) g.moveTo(x, yy);
        else g.lineTo(x, yy);
      }
      g.stroke();
      g.lineWidth = 1;
      return;
    }
    if (!mu) {
      g.fillText(t("Sin audio: abrir un archivo o pegar una direcci\xF3n"), 268, 58);
      return;
    }
    if (mu.estado !== "lista") {
      g.fillText(mu.estado === "error" ? t("no se pudo abrir") : t("bajando\u2026"), 268, 58);
      return;
    }
    const dur = mu.dur;
    const P = mu.picos.length / 2;
    const pintarForma = () => {
      g.fillStyle = C.tinta;
      for (let x = 0; x < 536; x++) {
        const k = Math.min(P - 1, Math.floor(x / 536 * P));
        const lo = mu.picos[2 * k];
        const hi = mu.picos[2 * k + 1];
        g.fillRect(x, 55 - hi * 50, 1, Math.max(1, (hi - lo) * 50));
      }
    };
    if (enTajadas()) {
      const cs = cortesDe(c);
      const xf2 = xDe(marcaDe(c, "fin", dur), dur);
      const baja = zona().baja;
      cs.forEach((s, i) => {
        const a = xDe(s, dur);
        const b = i + 1 < cs.length ? xDe(cs[i + 1], dur) : xf2;
        if (i % 2 === 0) {
          g.fillStyle = C.acento;
          g.globalAlpha = 0.13;
          g.fillRect(a, 1, Math.max(0, b - a), 108);
          g.globalAlpha = 1;
        }
      });
      pintarForma();
      g.fillStyle = C.pantalla;
      g.globalAlpha = 0.6;
      g.fillRect(0, 1, cs.length ? xDe(cs[0], dur) : 0, 108);
      g.fillRect(xf2, 1, 536 - xf2, 108);
      g.globalAlpha = 1;
      g.font = "9px system-ui, sans-serif";
      cs.forEach((s, i) => {
        const x2 = Math.round(xDe(s, dur)) + 0.5;
        g.strokeStyle = C.acento;
        g.lineWidth = tomada === `c${i}` ? 2 : 1;
        g.beginPath();
        g.moveTo(x2, 1);
        g.lineTo(x2, 109);
        g.stroke();
        g.lineWidth = 1;
        g.fillStyle = C.acento;
        g.textAlign = "left";
        if (cs.length <= 32 || i % 2 === 0) g.fillText(nombreNota(baja + i), Math.min(x2 + 2, 520), 10);
      });
      const x = Math.round(xf2) + 0.5;
      g.strokeStyle = C.tinta;
      g.lineWidth = tomada === "fin" ? 2 : 1;
      g.beginPath();
      g.moveTo(x, 1);
      g.lineTo(x, 109);
      g.stroke();
      g.lineWidth = 1;
      return;
    }
    if (c.loop) {
      const a = xDe(marcaDe(c, "lIni", dur), dur);
      const b = xDe(marcaDe(c, "lFin", dur), dur);
      g.fillStyle = C.acento;
      g.globalAlpha = 0.15;
      g.fillRect(a, 1, b - a, 108);
      g.globalAlpha = 1;
    }
    pintarForma();
    g.fillStyle = C.pantalla;
    g.globalAlpha = 0.6;
    g.fillRect(0, 1, xDe(marcaDe(c, "ini", dur), dur), 108);
    const xf = xDe(marcaDe(c, "fin", dur), dur);
    g.fillRect(xf, 1, 536 - xf, 108);
    g.globalAlpha = 1;
    const rotulos = { ini: "\u25B8", lIni: "[", lFin: "]", fin: "\u25C2" };
    for (const k of MARCAS) {
      if ((k === "lIni" || k === "lFin") && !c.loop) continue;
      const x = Math.round(xDe(marcaDe(c, k, dur), dur)) + 0.5;
      g.strokeStyle = k === "ini" || k === "fin" ? C.tinta : C.acento;
      g.lineWidth = tomada === k ? 2 : 1;
      g.beginPath();
      g.moveTo(x, 1);
      g.lineTo(x, 109);
      g.stroke();
      g.lineWidth = 1;
      g.fillStyle = g.strokeStyle;
      g.textAlign = "center";
      g.fillText(rotulos[k], entre(x, 6, 530), 12);
    }
  };
  const asegurarCortes = () => {
    const z = zona();
    const c = capa();
    if (!z || !z.tajadas || !c || !c.m || Array.isArray(c.cortes) || !durDe()) return false;
    c.cortes = nodo.detectarGolpes(c.m, z.sens === void 0 ? 50 : z.sens).map((x) => Math.round(x * 1e4) / 1e4);
    if (!c.cortes.length) c.cortes = [0];
    ajustarTajadas(z);
    return true;
  };
  const pintarTodo = () => {
    if (asegurarCortes()) {
      guardar();
      return pintarTodo();
    }
    const z = zona();
    const taj = !!(z && z.tajadas);
    titZona.textContent = z ? `${t("Zona")} ${zSel + 1}/${inst.zonas.length}${taj ? ` \xB7 ${t("Tajadas")}` : ""}` : t("Zonas");
    for (const x of [cBaja, cAlta, cRaiz, iGolpe]) x.el.style.opacity = z ? "" : "0.4";
    for (const x of [cAlta, cRaiz, iGolpe, iLoop, { el: altCaja }]) {
      x.el.style.opacity = taj || !z ? "0.4" : "";
      x.el.style.pointerEvents = taj ? "none" : "";
    }
    filaTajadas.style.display = taj ? "flex" : "none";
    if (taj) pSens.poner(z.sens === void 0 ? 50 : z.sens);
    if (z) {
      cBaja.poner(z.baja);
      cAlta.poner(z.alta);
      cRaiz.poner(z.raiz);
      iGolpe.poner(!!z.golpe);
    }
    botonesCapa.forEach((b, k) => {
      b.style.fontWeight = k === cSel ? "bold" : "";
      b.style.background = z && z.capas[k] ? k === cSel ? v("acento") : v("pantalla") : "transparent";
    });
    const c = capa();
    const mu = c && nodo.muestras[c.m];
    const esOsc = !!(c && c.osc);
    const esSoplo = !!(c && c.mod);
    nombreAudio.textContent = esOsc || esSoplo ? "" : mu ? `${mu.nombre}${mu.url ? "" : ` (${t("no queda guardado")})`}` : "";
    selFuente.poner(esSoplo ? 2 : esOsc ? 1 : 0);
    selFuente.el.style.display = c ? "" : "none";
    botonAbrir.style.display = esOsc || esSoplo ? "none" : "";
    if (elegirDeAnfitrion) botonPz.style.display = esOsc || esSoplo ? "none" : "";
    filaDir.style.display = esOsc || esSoplo ? "none" : "flex";
    oscCaja.style.display = esOsc ? "inline-flex" : "none";
    for (const x of [iLoop.el, altCaja]) x.style.display = esOsc || esSoplo ? "none" : "inline-flex";
    if (esOsc) {
      selForma.poner(Math.round(Number(c.osc.forma) || 0));
      pAncho.poner(Number(c.osc.ancho) || 50);
      pAncho.el.style.opacity = Math.round(Number(c.osc.forma) || 0) === 3 ? "" : "0.4";
    }
    if (c) {
      iLoop.poner(!!c.loop);
      const alt = Array.isArray(c.alt) ? c.alt : [true, true, true];
      iAlt.forEach((x, k) => x.poner(alt[k] !== false));
      pGan.poner(Number(c.gan) || 0);
      pPan.poner(Number(c.pan) || 0);
      pAfin.poner(Number(c.afinar) || 0);
    }
    pintarTeclado();
    pintarOnda();
    pintarEstirar();
    moldeado.ponerCapa(cSel + 1);
  };
  pintarTodo();
  const quitar = nodo.alCambiar(() => {
    if (!tomada) {
      inst = copia(nodo.inst);
      if (zSel >= inst.zonas.length) zSel = inst.zonas.length - 1;
      if (zSel < 0 && inst.zonas.length) zSel = 0;
      const z = zona();
      if (z && cSel >= z.capas.length) cSel = 0;
    }
    pintarTodo();
  });
  let vigente = true;
  const reloj = setInterval(() => {
    if (!vigente) return;
    const antes = JSON.stringify(C);
    C = coloresDe(caja);
    if (JSON.stringify(C) !== antes) {
      pintarTeclado();
      pintarOnda();
      moldeado.pintar();
    }
    void nodo.getParameterValues(false).then((vals) => {
      if (!vals || !vigente) return;
      for (const p of N.PARAMS) {
        const c2 = generales[p.id];
        if (c2 && vals[p.id] && !c2.agarrada()) c2.poner(Number(vals[p.id].value));
      }
      moldeado.ponerValores(vals);
      const c = capa();
      if (c && c.mod) pintarOnda();
    });
    if (!caja.isConnected && visto) soltar();
    if (caja.isConnected) visto = true;
  }, 500);
  let visto = false;
  const soltar = () => {
    if (!vigente) return;
    vigente = false;
    clearInterval(reloj);
    quitar();
  };
  caja._pzSoltar = soltar;
  return caja;
}

// sampler/estirar.js
function estirador() {
  const N2 = 2048;
  const HS = 512;
  function fft(re, im, inv) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let b = n >> 1;
      for (; j & b; b >>= 1) j ^= b;
      j ^= b;
      if (i < j) {
        let t2 = re[i];
        re[i] = re[j];
        re[j] = t2;
        t2 = im[i];
        im[i] = im[j];
        im[j] = t2;
      }
    }
    for (let largo = 2; largo <= n; largo <<= 1) {
      const ang = (inv ? 2 : -2) * Math.PI / largo;
      const wr = Math.cos(ang);
      const wi = Math.sin(ang);
      const mitad = largo >> 1;
      for (let i = 0; i < n; i += largo) {
        let cr = 1;
        let ci = 0;
        for (let k = 0; k < mitad; k++) {
          const a = i + k;
          const b = a + mitad;
          const tr = re[b] * cr - im[b] * ci;
          const ti = re[b] * ci + im[b] * cr;
          re[b] = re[a] - tr;
          im[b] = im[a] - ti;
          re[a] += tr;
          im[a] += ti;
          const nr = cr * wr - ci * wi;
          ci = cr * wi + ci * wr;
          cr = nr;
        }
      }
    }
  }
  const envolver = (x) => x - 2 * Math.PI * Math.round(x / (2 * Math.PI));
  function estirarTramos2(canales, tramos) {
    const ts = tramos.map((t2) => ({ a: t2.a, b: Math.max(t2.a, t2.b), f: Math.max(0.125, Math.min(8, Number(t2.f) || 1)) }));
    const bordes = [0];
    for (const t2 of ts) bordes.push(bordes[bordes.length - 1] + (t2.b - t2.a) * t2.f);
    const largo = Math.max(1, Math.round(bordes[bordes.length - 1]));
    if (!ts.length) return { canales: canales.map(() => new Float32Array(1)), bordes: [0] };
    const original = (s) => {
      for (let i = 0; i < ts.length; i++) if (s < bordes[i + 1] || i === ts.length - 1) return ts[i].a + Math.min(ts[i].b - ts[i].a, (s - bordes[i]) / ts[i].f);
      return ts[ts.length - 1].b;
    };
    const ventana = new Float64Array(N2);
    for (let i = 0; i < N2; i++) ventana[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N2);
    const B = N2 / 2 + 1;
    const omega = new Float64Array(B);
    for (let k = 0; k < B; k++) omega[k] = 2 * Math.PI * k / N2;
    const cuadros = Math.ceil((largo + N2) / HS) + 1;
    const sal = canales.map(() => new Float32Array(largo + N2));
    const peso = new Float64Array(largo + N2);
    for (let q = 0; q < cuadros; q++) {
      const t2 = q * HS - N2 / 2;
      for (let i = 0; i < N2; i++) {
        const j = t2 + i;
        if (j >= 0 && j < peso.length) peso[j] += ventana[i] * ventana[i];
      }
    }
    const re = new Float64Array(N2);
    const im = new Float64Array(N2);
    const mag = new Float64Array(B);
    const fase = new Float64Array(B);
    const faseAntes = new Float64Array(B);
    const faseSal = new Float64Array(B);
    const pico = new Int32Array(B);
    for (let c = 0; c < canales.length; c++) {
      const x = canales[c];
      const o = sal[c];
      let posAntes = 0;
      for (let q = 0; q < cuadros; q++) {
        const t2 = q * HS - N2 / 2;
        const centro = original(Math.max(0, Math.min(largo, t2 + N2 / 2)));
        const pos = Math.round(centro - N2 / 2);
        for (let i = 0; i < N2; i++) {
          const j = pos + i;
          re[i] = (j >= 0 && j < x.length ? x[j] : 0) * ventana[i];
          im[i] = 0;
        }
        fft(re, im, false);
        for (let k = 0; k < B; k++) {
          mag[k] = Math.hypot(re[k], im[k]);
          fase[k] = Math.atan2(im[k], re[k]);
        }
        if (q === 0) {
          for (let k = 0; k < B; k++) faseSal[k] = fase[k];
        } else {
          const ha = pos - posAntes;
          const esPico = [];
          for (let k = 0; k < B; k++) {
            const m = mag[k];
            if ((k < 1 || m > mag[k - 1]) && (k < 2 || m > mag[k - 2]) && (k + 1 >= B || m >= mag[k + 1]) && (k + 2 >= B || m >= mag[k + 2])) esPico.push(k);
          }
          if (!esPico.length) esPico.push(0);
          let p = 0;
          for (let k = 0; k < B; k++) {
            while (p + 1 < esPico.length && Math.abs(esPico[p + 1] - k) < Math.abs(esPico[p] - k)) p++;
            pico[k] = esPico[p];
          }
          const avance = new Float64Array(B);
          for (const k of esPico) {
            const d = ha > 0 ? envolver(fase[k] - faseAntes[k] - omega[k] * ha) : 0;
            const frec = omega[k] + (ha > 0 ? d / ha : 0);
            avance[k] = faseSal[k] + frec * HS;
          }
          for (let k = 0; k < B; k++) {
            const pk = pico[k];
            faseSal[k] = avance[pk] + (fase[k] - fase[pk]);
          }
        }
        for (let k = 0; k < B; k++) faseAntes[k] = fase[k];
        posAntes = pos;
        for (let k = 0; k < B; k++) {
          re[k] = mag[k] * Math.cos(faseSal[k]);
          im[k] = mag[k] * Math.sin(faseSal[k]);
        }
        for (let k = B; k < N2; k++) {
          re[k] = re[N2 - k];
          im[k] = -im[N2 - k];
        }
        fft(re, im, true);
        for (let i = 0; i < N2; i++) {
          const j = t2 + i;
          if (j >= 0 && j < o.length) o[j] += re[i] / N2 * ventana[i];
        }
      }
      for (let j = 0; j < o.length; j++) o[j] = peso[j] > 1e-3 ? o[j] / peso[j] : 0;
    }
    return { canales: sal.map((o) => o.slice(0, largo)), bordes: bordes.map((b) => Math.round(b)) };
  }
  return { estirarTramos: estirarTramos2 };
}
var estirarTramos = (canales, tramos) => estirador().estirarTramos(canales, tramos);
function segundosDe(est, bpm) {
  if (!est || !(Number(est.v) > 0)) return 0;
  if (est.u === "t") return Number(est.v) * 60 / Math.max(1, Number(bpm) || 120);
  return Number(est.v) / 1e3;
}

// sampler/index.js
var mandados = /* @__PURE__ */ new WeakMap();
var PICOS = 1500;
var cuenta = 0;
var nuevoId = () => `m${Date.now().toString(36)}${(cuenta++).toString(36)}`;
var NodoSampler = class extends WamNode {
  async getParameterInfo(...ids) {
    return traducirInfo(await super.getParameterInfo(...ids));
  }
  static addModules(contexto, moduleId) {
    let p = mandados.get(contexto);
    if (!p) {
      p = (async () => {
        await super.addModules(contexto, moduleId);
        await mandarConFunciones(contexto.audioWorklet, procesadorSampler, moduleId, nucleoSampler);
      })();
      mandados.set(contexto, p);
      p.catch(() => mandados.delete(contexto));
    }
    return p;
  }
  constructor(modulo) {
    super(modulo, {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2]
    });
    this.inst = { zonas: [] };
    this.muestras = {};
    this._oyentes = /* @__PURE__ */ new Set();
    this._audios = {};
    this.bpm = 120;
    this._estirados = /* @__PURE__ */ new Map();
    this._necesarias = /* @__PURE__ */ new Set();
    this._cola = [];
    this._enCurso = null;
    this._reloj = 0;
  }
  // Lo que manda el hilo de audio: el tempo del anfitrión.
  _onMessage(message) {
    const d = message && message.data;
    if (d && d.pz === "tempo") {
      this.bpm = Number(d.bpm) || 120;
      this._mandarInst();
      this._avisar();
      return;
    }
    return super._onMessage(message);
  }
  // Quien dibuja se entera de los cambios (el instrumento, una muestra que terminó de bajar).
  alCambiar(f) {
    this._oyentes.add(f);
    return () => this._oyentes.delete(f);
  }
  _avisar() {
    for (const f of this._oyentes) {
      try {
        f();
      } catch (e) {
      }
    }
  }
  ponerInstrumento(inst) {
    this.inst = inst && Array.isArray(inst.zonas) ? inst : { zonas: [] };
    this._mandarInst();
    this._avisar();
  }
  // EL INSTRUMENTO QUE SUENA: el mismo, pero con cada capa que se estira al tempo cambiada por su
  // muestra estirada (y sus marcas, a lo estirado), y, si además sigue la altura de la nota, con
  // una versión estirada por cada nota (`var`), para que el largo no cambie con la altura (JP:
  // «mantener el pitch y el largo»). Estirar pesa: se hace en un Worker (o, si la página no lo
  // deja, aquí mismo, de a uno), y mientras tanto suena lo que ya está.
  _mandarInst() {
    this._enviarInst(this._resolver());
  }
  _enviarInst(inst) {
    if (this._destroyed) return;
    this.port.postMessage({ pz: "inst", inst });
    for (const [llave, x] of this._estirados) {
      if (this._necesarias.has(llave)) continue;
      this._estirados.delete(llave);
      this.port.postMessage({ pz: "quitar", m: x.id });
    }
  }
  _resolver() {
    const necesarias = /* @__PURE__ */ new Set();
    const pedidos = [];
    const zonas = this.inst.zonas.map((z) => ({ ...z, capas: (z.capas || []).map((c) => this._estirarCapa(z, c, necesarias, pedidos)) }));
    this._necesarias = necesarias;
    pedidos.sort((a, b) => a.orden - b.orden);
    this._cola = pedidos.filter((x) => !this._estirados.has(x.llave));
    this._seguir();
    return { zonas };
  }
  // Las partes de una capa como tramos del audio: [desde, hasta, ajuste, sigue la nota].
  _partes(z, c, dur) {
    const num = (x, d) => x === void 0 || x === null ? d : Math.max(0, Math.min(dur, Number(x) || 0));
    const fin = num(c.fin, dur);
    const alt = Array.isArray(c.alt) ? c.alt : [];
    if (z.tajadas) {
      const cs = Array.isArray(c.cortes) && c.cortes.length ? c.cortes : [0];
      return [[cs[0], fin, c.est[0], false]];
    }
    const ini = num(c.ini, 0);
    if (!c.loop) return [[ini, fin, c.est[0], alt[1] !== false]];
    const lIni = Math.max(ini, num(c.lIni, ini));
    const lFin = Math.min(fin, Math.max(lIni, num(c.lFin, fin)));
    return [
      [ini, lIni, c.est[0], alt[0] !== false],
      [lIni, lFin, c.est[1], alt[1] !== false],
      [lFin, fin, c.est[2], alt[2] !== false]
    ];
  }
  // Las marcas de una capa sobre lo estirado.
  _marcas(z, c, partes, x, fm, f0) {
    const s = (k) => x.bordes[k] / fm;
    if (z.tajadas) return { m: x.id, cortes: (c.cortes && c.cortes.length ? c.cortes : [0]).map((k) => Math.max(0, (k - partes[0][0]) * f0)), fin: s(1) };
    if (c.loop) return { m: x.id, ini: 0, lIni: s(1), lFin: s(2), fin: s(3) };
    return { m: x.id, ini: 0, lIni: void 0, lFin: void 0, fin: s(1) };
  }
  _estirarCapa(z, c, necesarias, pedidos) {
    const au = c && !c.osc && !c.mod && this._audios[c.m];
    if (!au || !Array.isArray(c.est)) return c;
    const fm = au.fm;
    const partes = this._partes(z, c, au.canales[0].length / fm);
    const base = partes.map(([a, b, e]) => {
      const s = segundosDe(e, this.bpm);
      return { a: Math.round(a * fm), b: Math.round(b * fm), f: s > 0 && b > a ? Math.round(s / (b - a) * 1e4) / 1e4 : 1 };
    });
    if (base.every((t2) => t2.f === 1)) return c;
    const pedir = (tramos, orden) => {
      const llave = `${c.m}|${tramos.map((t2) => `${t2.a},${t2.b},${t2.f}`).join("|")}`;
      necesarias.add(llave);
      const x = this._estirados.get(llave);
      if (!x) pedidos.push({ llave, m: c.m, au, tramos, orden });
      return x || null;
    };
    const xb = pedir(base, 0);
    const sale = xb ? { ...c, ...this._marcas(z, c, partes, xb, fm, base[0].f) } : { ...c };
    const conNota = !z.tajadas && partes.some(([, , e, sigue], k) => sigue && base[k].f !== 1);
    if (conNota) {
      const raiz = Number(z.raiz) || 60;
      const vars = {};
      for (let n = Math.max(z.baja, raiz - 24); n <= Math.min(z.alta, raiz + 24); n++) {
        const r = Math.pow(2, (n - raiz + (Number(c.afinar) || 0)) / 12);
        if (Math.abs(r - 1) < 1e-3) continue;
        const tramos = base.map((t2, k) => partes[k][3] && t2.f !== 1 ? { ...t2, f: Math.round(t2.f * r * 1e4) / 1e4 } : t2);
        const x = pedir(tramos, 1 + Math.abs(n - raiz));
        if (x) vars[n] = this._marcas(z, c, partes, x, fm, tramos[0].f);
      }
      sale.var = vars;
    }
    return sale;
  }
  // El Worker que estira (una vez por nodo); null si la página no deja crearlo.
  _trabajador() {
    if (this._worker !== void 0) return this._worker;
    try {
      const src = `const E = (${estirador.toString()})();
onmessage = (ev) => { const r = E.estirarTramos(ev.data.canales, ev.data.tramos); postMessage({ canales: r.canales, bordes: r.bordes }, r.canales.map((k) => k.buffer)); };`;
      this._worker = new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })));
    } catch (e) {
      this._worker = null;
    }
    return this._worker;
  }
  // Estirar lo que sigue en la cola, de a uno.
  _seguir() {
    if (this._enCurso || this._destroyed) return;
    let p = this._cola.shift();
    while (p && (!this._necesarias.has(p.llave) || this._estirados.has(p.llave))) p = this._cola.shift();
    if (!p) return;
    this._enCurso = p.llave;
    const a = p.tramos[0].a;
    const b = p.tramos[p.tramos.length - 1].b;
    const canales = p.au.canales.map((k) => k.slice(a, b));
    const tramos = p.tramos.map((t2) => ({ a: t2.a - a, b: t2.b - a, f: t2.f }));
    const listo = (r) => {
      this._enCurso = null;
      if (this._destroyed) return;
      const x = { id: `${p.m}~${(cuenta++).toString(36)}`, bordes: r.bordes };
      this._estirados.set(p.llave, x);
      this.port.postMessage({ pz: "muestra", m: x.id, canales: r.canales, fm: p.au.fm }, r.canales.map((k) => k.buffer));
      clearTimeout(this._reloj);
      this._reloj = setTimeout(() => this._enviarInst(this._resolver()), 60);
      this._seguir();
    };
    const aqui = () => setTimeout(() => listo(estirarTramos(canales, tramos)), 0);
    const w = this._trabajador();
    if (!w) {
      aqui();
      return;
    }
    w.onmessage = (ev) => listo(ev.data);
    w.onerror = () => {
      this._worker = null;
      aqui();
    };
    try {
      w.postMessage({ canales, tramos });
    } catch (e) {
      this._worker = null;
      aqui();
    }
  }
  destroy() {
    if (this._worker) this._worker.terminate();
    super.destroy();
  }
  // Una muestra desde una dirección web (queda en el estado) o desde un archivo (no queda).
  async cargarDireccion(url, nombre, m = nuevoId()) {
    this.muestras[m] = { url, nombre: nombre || decodeURIComponent(String(url).split("/").pop() || "audio"), estado: "bajando" };
    this._avisar();
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(String(r.status));
      await this._decodificar(m, await r.arrayBuffer());
    } catch (e) {
      this.muestras[m].estado = "error";
      this._avisar();
    }
    return m;
  }
  async cargarArchivo(archivo, m = nuevoId()) {
    this.muestras[m] = { url: null, nombre: archivo.name, estado: "bajando" };
    this._avisar();
    try {
      await this._decodificar(m, await archivo.arrayBuffer());
    } catch (e) {
      this.muestras[m].estado = "error";
      this._avisar();
    }
    return m;
  }
  async _decodificar(m, datos) {
    const b = await this.context.decodeAudioData(datos);
    const canales = [];
    for (let c = 0; c < Math.min(2, b.numberOfChannels); c++) canales.push(b.getChannelData(c).slice());
    const picos = new Float32Array(PICOS * 2);
    const n = canales[0].length;
    for (let k = 0; k < PICOS; k++) {
      let lo = 0;
      let hi = 0;
      const a = Math.floor(k * n / PICOS);
      const z = Math.max(a + 1, Math.floor((k + 1) * n / PICOS));
      for (let i = a; i < z && i < n; i++) {
        for (const ch of canales) {
          const x = ch[i];
          if (x < lo) lo = x;
          if (x > hi) hi = x;
        }
      }
      picos[2 * k] = lo;
      picos[2 * k + 1] = hi;
    }
    const en = energias(canales, b.sampleRate);
    Object.assign(this.muestras[m], { estado: "lista", dur: b.duration, picos, en });
    this._audios[m] = { canales, fm: b.sampleRate };
    const copia2 = canales.map((c) => c.slice());
    if (!this._destroyed) this.port.postMessage({ pz: "muestra", m, canales: copia2, fm: b.sampleRate }, copia2.map((c) => c.buffer));
    this._mandarInst();
    this._avisar();
  }
  // Dónde empiezan los golpes de una muestra (segundos); `sens` 0…100.
  detectarGolpes(m, sens) {
    const mu = this.muestras[m];
    return mu && mu.en ? golpes(mu.en, sens) : [];
  }
  // Tocar una nota desde la carátula (para oír una tajada).
  tocar(nota) {
    const t0 = this.context.currentTime;
    this.scheduleEvents({ type: "wam-midi", time: t0, data: { bytes: [144, nota, 100] } }, { type: "wam-midi", time: t0 + 0.05, data: { bytes: [128, nota, 0] } });
  }
  quitarMuestra(m) {
    delete this.muestras[m];
    delete this._audios[m];
    if (!this._destroyed) this.port.postMessage({ pz: "quitar", m });
    this._avisar();
  }
  async getState() {
    const s = await super.getState() || {};
    const muestras = {};
    for (const [m, x] of Object.entries(this.muestras)) if (x.url) muestras[m] = { url: x.url, nombre: x.nombre };
    return { ...s, inst: this.inst, muestras };
  }
  async setState(estado) {
    await super.setState(estado);
    if (!estado || typeof estado !== "object") return;
    if (estado.inst) this.ponerInstrumento(estado.inst);
    const pedidas = estado.muestras && typeof estado.muestras === "object" ? estado.muestras : {};
    for (const [m, x] of Object.entries(pedidas)) {
      if (!x || typeof x.url !== "string") continue;
      const ya = this.muestras[m];
      if (ya && ya.url === x.url && ya.estado !== "error") continue;
      void this.cargarDireccion(x.url, x.nombre, m);
    }
  }
};
var Sampler = class extends WebAudioModule_default {
  async initialize(estado) {
    Object.assign(this._descriptor, descriptor_default);
    if (!this._audioNode) this.audioNode = await this.createAudioNode(estado);
    this.initialized = true;
    return this;
  }
  async createAudioNode(estado) {
    await NodoSampler.addModules(this.audioContext, this.moduleId);
    const nodo = new NodoSampler(this);
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
  NodoSampler,
  Sampler as default
};
