function playAILoop() {
  if (!result) return alert("Generate a loop first.");

  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const bpmVal = Number(result.bpm || bpm);
  const secondsPerBeat = 60 / bpmVal;
  const bars = 8;
  const beatsPerBar = 4;
  const totalBeats = bars * beatsPerBar;
  const start = audioCtx.currentTime + 0.1;

  // swing (trap feel)
  const swing = 0.06; // 0–0.1

  // simple guitar-ish synth (pluck + slight detune)
  function guitar(freq, time, dur = secondsPerBeat * 1.5, vel = 0.2) {
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const filt = audioCtx.createBiquadFilter();

    osc1.type = "triangle";
    osc2.type = "sawtooth";
    osc1.frequency.value = freq;
    osc2.frequency.value = freq * 1.01;

    filt.type = "lowpass";
    filt.frequency.value = 2200;

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(vel, time + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0008, time + dur);

    osc1.connect(filt);
    osc2.connect(filt);
    filt.connect(gain);
    gain.connect(audioCtx.destination);

    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + dur);
    osc2.stop(time + dur);
  }

  function kick(time) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(120, time);
    osc.frequency.exponentialRampToValueAtTime(40, time + 0.15);

    gain.gain.setValueAtTime(0.9, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(time);
    osc.stop(time + 0.2);
  }

  function snare(time) {
    const noise = audioCtx.createBufferSource();
    const buffer = audioCtx.createBuffer(1, 44100, 44100);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    noise.buffer = buffer;

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);

    noise.connect(gain);
    gain.connect(audioCtx.destination);

    noise.start(time);
    noise.stop(time + 0.12);
  }

  function hat(time, vel = 0.05) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "square";
    osc.frequency.value = 9000;

    gain.gain.setValueAtTime(vel, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(time);
    osc.stop(time + 0.04);
