// Dumb capture worklet: forwards mono Float32 frames to the main thread.
// VAD and utterance segmentation happen on the main thread (see lib/vad.ts).
class RecorderProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (channel && channel.length > 0) {
      // Copy — the input buffer is reused by the audio thread.
      this.port.postMessage(new Float32Array(channel));
    }
    return true;
  }
}

registerProcessor("recorder", RecorderProcessor);
