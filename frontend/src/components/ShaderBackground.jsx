import { useEffect, useRef } from 'react';

const ShaderBackground = ({ stressLevel = 0 }) => {
  const canvasRef      = useRef(null);
  const stressRef      = useRef(0);
  const smoothedStress = useRef(0);

  useEffect(() => {
    stressRef.current = stressLevel ?? 0;
  }, [stressLevel]);

  const vsSource = `
    attribute vec4 aVertexPosition;
    void main() {
      gl_Position = aVertexPosition;
    }
  `;

  const fsSource = `
    precision highp float;
    uniform vec2 iResolution;
    uniform float iTime;
    uniform float iStress;

    const float overallSpeed = 0.15;
    const float gridSmoothWidth = 0.015;
    const float axisWidth = 0.05;
    const float majorLineWidth = 0.025;
    const float minorLineWidth = 0.0125;
    const float majorLineFrequency = 5.0;
    const float minorLineFrequency = 1.0;
    const float scale = 5.0;
    const float minLineWidth = 0.01;
    const float maxLineWidth = 0.15;
    const float lineSpeed = 1.0 * overallSpeed;
    const float lineAmplitude = 1.0;
    const float lineFrequency = 0.2;
    const float warpSpeed = 0.2 * overallSpeed;
    const float warpFrequency = 0.5;
    const float warpAmplitude = 1.0;
    const float offsetFrequency = 0.5;
    const float offsetSpeed = 1.33 * overallSpeed;
    const float minOffsetSpread = 0.6;
    const float maxOffsetSpread = 2.0;
    const int linesPerGroup = 12;

    #define drawCircle(pos, radius, coord) smoothstep(radius + gridSmoothWidth, radius, length(coord - (pos)))
    #define drawSmoothLine(pos, halfWidth, t) smoothstep(halfWidth, 0.0, abs(pos - (t)))
    #define drawCrispLine(pos, halfWidth, t) smoothstep(halfWidth + gridSmoothWidth, halfWidth, abs(pos - (t)))
    #define drawPeriodicLine(freq, width, t) drawCrispLine(freq / 2.0, width, abs(mod(t, freq) - (freq) / 2.0))

    float random(float t) {
      return (cos(t) + cos(t * 1.3 + 1.3) + cos(t * 1.4 + 1.4)) / 3.0;
    }

    float getPlasmaY(float x, float horizontalFade, float offset) {
      return random(x * lineFrequency + iTime * lineSpeed) * horizontalFade * lineAmplitude + offset;
    }

    void main() {
      vec2 fragCoord = gl_FragCoord.xy;
      vec2 uv = fragCoord.xy / iResolution.xy;
      vec2 space = (fragCoord - iResolution.xy / 2.0) / iResolution.x * 2.0 * scale;

      float horizontalFade = 1.0 - (cos(uv.x * 6.28) * 0.5 + 0.5);
      float verticalFade = 1.0 - (cos(uv.y * 6.28) * 0.5 + 0.5);

      // Speed increases with stress
      float speed = 1.0 + iStress * 3.0;
      space.y += random(space.x * warpFrequency + iTime * warpSpeed * speed) * warpAmplitude * (0.5 + horizontalFade);
      space.x += random(space.y * warpFrequency + iTime * warpSpeed * speed + 2.0) * warpAmplitude * horizontalFade;

      // Line color: cyan/teal when relaxed → red/orange when stressed
      vec4 lineColor = mix(
        vec4(0.1, 0.7, 0.9, 1.0),   // relaxed: cyan
        vec4(0.9, 0.2, 0.1, 1.0),   // stressed: red
        iStress
      );

      // Background: deep navy when relaxed → deep crimson when stressed
      vec4 bgColor1 = mix(vec4(0.03, 0.05, 0.12, 1.0), vec4(0.12, 0.03, 0.05, 1.0), iStress);
      vec4 bgColor2 = mix(vec4(0.05, 0.08, 0.18, 1.0), vec4(0.18, 0.05, 0.08, 1.0), iStress);

      vec4 lines = vec4(0.0);
      for(int l = 0; l < linesPerGroup; l++) {
        float normalizedLineIndex = float(l) / float(linesPerGroup);
        float offsetTime = iTime * offsetSpeed * speed;
        float offsetPosition = float(l) + space.x * offsetFrequency;
        float rand = random(offsetPosition + offsetTime) * 0.5 + 0.5;
        float halfWidth = mix(minLineWidth, maxLineWidth, rand * horizontalFade) / 2.0;
        float offset = random(offsetPosition + offsetTime * (1.0 + normalizedLineIndex)) * mix(minOffsetSpread, maxOffsetSpread, horizontalFade);
        float linePosition = getPlasmaY(space.x, horizontalFade, offset);
        float line = drawSmoothLine(linePosition, halfWidth, space.y) / 2.0
                   + drawCrispLine(linePosition, halfWidth * 0.15, space.y);

        float circleX = mod(float(l) + iTime * lineSpeed * speed, 25.0) - 12.0;
        vec2 circlePosition = vec2(circleX, getPlasmaY(circleX, horizontalFade, offset));
        float circle = drawCircle(circlePosition, 0.01, space) * 4.0;

        lines += (line + circle) * lineColor * rand;
      }

      vec4 fragColor = mix(bgColor1, bgColor2, uv.x);
      fragColor *= verticalFade;
      fragColor.a = 1.0;
      fragColor += lines;
      gl_FragColor = fragColor;
    }
  `;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl');
    if (!gl) return;

    const loadShader = (gl, type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vs = loadShader(gl, gl.VERTEX_SHADER, vsSource);
    const fs = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

    const attribs = { vertexPosition: gl.getAttribLocation(prog, 'aVertexPosition') };
    const uniforms = {
      resolution: gl.getUniformLocation(prog, 'iResolution'),
      time:       gl.getUniformLocation(prog, 'iTime'),
      stress:     gl.getUniformLocation(prog, 'iStress'),
    };

    const resizeCanvas = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    let startTime = Date.now();
    let animId;
    const render = () => {
      const t = (Date.now() - startTime) / 1000;

      // Smoothly lerp displayed stress toward target (0.05 = slow, 0.15 = faster)
      smoothedStress.current += (stressRef.current - smoothedStress.current) * 0.05;

      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(prog);
      gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
      gl.uniform1f(uniforms.time, t);
      gl.uniform1f(uniforms.stress, smoothedStress.current);
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.vertexAttribPointer(attribs.vertexPosition, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(attribs.vertexPosition);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      animId = requestAnimationFrame(render);
    };
    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  return <canvas ref={canvasRef} style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }} />;
};

export default ShaderBackground;
