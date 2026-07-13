import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

type StepResult = {
  name: string;
  ok: boolean;
  duration_ms: number;
  observations: Record<string, unknown>;
  note?: string;
};

type ShellResult = {
  stdout: string;
  stderr: string;
};

const packageName = process.env.MOBILE_REAL_DEVICE_PACKAGE ?? "com.skillsroom.mobile";
const chatChannel = process.env.MOBILE_REAL_DEVICE_CHAT_CHANNEL ?? "chat_load_lab";
const reportDir = path.join(process.cwd(), "reports", "real-device-chat-qa");
const adbPath = process.env.MOBILE_QA_ADB_PATH ?? path.join(process.env.LOCALAPPDATA ?? "", "Android", "Sdk", "platform-tools", "adb.exe");
const deviceId = process.env.MOBILE_QA_DEVICE_ID;
const toggleData = process.env.MOBILE_QA_TOGGLE_DATA === "1";
const toggleWifi = process.env.MOBILE_QA_TOGGLE_WIFI === "1";

async function main() {
  await mkdir(reportDir, { recursive: true });
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const artifactsDir = path.join(reportDir, runId);
  await mkdir(artifactsDir, { recursive: true });

  const device = await selectDevice();
  const deviceMeta = await collectDeviceMeta(device);
  const steps: StepResult[] = [];

  await adb(device, ["reverse", "tcp:8081", "tcp:8081"]).catch(() => undefined);
  await adb(device, ["reverse", "tcp:4100", "tcp:4100"]).catch(() => undefined);
  await adb(device, ["logcat", "-c"]).catch(() => undefined);

  steps.push(await step("launch_and_render", async () => {
    await adb(device, ["shell", "am", "force-stop", packageName]);
    await launchApp(device);
    await sleep(20_000);
    const uiXml = await dumpUi(device);
    const screenshotPath = path.join(artifactsDir, "launch.png");
    await screenshot(device, screenshotPath).catch(() => undefined);
    const textValues = extractTextValues(uiXml);
    const renderedText = textValues.filter((text) => text.trim().length > 0);
    const redbox = renderedText.some((text) => /unable to load script|exception|error/i.test(text));
    return {
      ok: renderedText.length > 0 && !redbox,
      observations: {
        rendered_text_count: renderedText.length,
        rendered_text_sample: renderedText.slice(0, 12),
        redbox_detected: redbox,
        screenshot_path: screenshotPath
      },
      note: renderedText.length === 0 ? "App launched but rendered an empty native root." : redbox ? "React Native redbox was visible." : undefined
    };
  }, 45_000));

  steps.push(await step("background_foreground", async () => {
    await sendHome(device);
    await sleep(3_000);
    await launchApp(device);
    await sleep(20_000);
    const uiXml = await dumpUi(device);
    const textValues = extractTextValues(uiXml).filter((text) => text.trim().length > 0);
    return {
      ok: textValues.length > 0,
      observations: {
        rendered_text_count: textValues.length,
        rendered_text_sample: textValues.slice(0, 12)
      },
      note: textValues.length === 0 ? "No app UI text after background/foreground." : undefined
    };
  }, 50_000));

  steps.push(await step("chat_tab_deeplink", async () => {
    await openDeepLink(device, "skillsroom:///chat");
    await sleep(10_000);
    const uiXml = await dumpUi(device);
    const screenshotPath = path.join(artifactsDir, "chat-tab.png");
    await screenshot(device, screenshotPath).catch(() => undefined);
    const textValues = extractTextValues(uiXml);
    const hasChatShell = includesText(textValues, "CHAT") && (
      includesText(textValues, "Channels") ||
      includesText(textValues, "DMs") ||
      textValues.some((value) => /Global, rooms, and DMs/i.test(value))
    );
    return {
      ok: hasChatShell,
      observations: {
        rendered_text_count: textValues.length,
        rendered_text_sample: textValues.slice(0, 16),
        screenshot_path: screenshotPath
      },
      note: hasChatShell ? undefined : "Chat tab did not render expected channel/DM shell."
    };
  }, 35_000));

  steps.push(await step("chat_channel_deeplink", async () => {
    await openDeepLink(device, `skillsroom://chat/${encodeURIComponent(chatChannel)}`);
    await sleep(15_000);
    const uiXml = await dumpUi(device);
    const screenshotPath = path.join(artifactsDir, "chat-channel.png");
    await screenshot(device, screenshotPath).catch(() => undefined);
    const textValues = extractTextValues(uiXml);
    const hasComposer = includesText(textValues, "Message");
    const hasMessages = textValues.some((value) => /Chat Load|@|load/i.test(value));
    return {
      ok: hasComposer && hasMessages,
      observations: {
        channel: chatChannel,
        rendered_text_count: textValues.length,
        rendered_text_sample: textValues.slice(0, 20),
        composer_visible: hasComposer,
        message_content_visible: hasMessages,
        screenshot_path: screenshotPath
      },
      note: hasComposer && hasMessages ? undefined : "Chat channel did not show both message content and composer."
    };
  }, 45_000));

  if (toggleData || toggleWifi) {
    steps.push(await step("network_toggle_recovery", async () => {
      const before = await networkState(device);
      if (toggleData) await adb(device, ["shell", "svc", "data", "disable"]);
      if (toggleWifi) await adb(device, ["shell", "svc", "wifi", "disable"]);
      await sleep(5_000);
      if (toggleWifi) await adb(device, ["shell", "svc", "wifi", "enable"]);
      if (toggleData) await adb(device, ["shell", "svc", "data", "enable"]);
      await sleep(12_000);
      await launchApp(device);
      await sleep(5_000);
      const after = await networkState(device);
      const uiXml = await dumpUi(device);
      const textValues = extractTextValues(uiXml).filter((text) => text.trim().length > 0);
      return {
        ok: textValues.length > 0,
        observations: { before, after, rendered_text_count: textValues.length, rendered_text_sample: textValues.slice(0, 12) },
        note: textValues.length === 0 ? "No rendered app UI after network toggle recovery." : undefined
      };
    }, 45_000));
  }

  const logcat = await adb(device, ["logcat", "-d", "-v", "time"], { timeoutMs: 30_000 }).then((result) => result.stdout).catch((error) => String(error));
  const logcatPath = path.join(artifactsDir, "logcat.txt");
  await writeFile(logcatPath, logcat, "utf8");
  const meminfo = await adb(device, ["shell", "dumpsys", "meminfo", packageName], { timeoutMs: 15_000 }).then((result) => result.stdout).catch((error) => String(error));
  const gfxinfo = await adb(device, ["shell", "dumpsys", "gfxinfo", packageName, "framestats"], { timeoutMs: 15_000 }).then((result) => result.stdout).catch((error) => String(error));

  const report = {
    run_id: runId,
    started_at: new Date().toISOString(),
    package_name: packageName,
    device,
    device_meta: deviceMeta,
    steps,
    log_summary: summarizeLogs(logcat),
    memory_summary: summarizeMeminfo(meminfo),
    frame_summary: summarizeGfxinfo(gfxinfo),
    artifacts: {
      dir: artifactsDir,
      logcat: logcatPath
    },
    ok: steps.every((item) => item.ok) && summarizeLogs(logcat).fatal_count === 0
  };

  const reportPath = path.join(reportDir, `chat-real-device-qa-${runId}.json`);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(path.join(reportDir, "latest.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");

  printReport(report, reportPath);
  if (!report.ok) process.exitCode = 1;
}

async function selectDevice() {
  const result = await adbRaw(["devices"]);
  const devices = result.stdout.split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/))
    .filter(([id, state]) => id && state === "device")
    .map(([id]) => id);
  if (deviceId) {
    if (!devices.includes(deviceId)) throw new Error(`Device ${deviceId} is not connected. Connected: ${devices.join(", ") || "none"}`);
    return deviceId;
  }
  if (devices.length !== 1) throw new Error(`Expected exactly one connected device. Connected: ${devices.join(", ") || "none"}`);
  return devices[0];
}

async function collectDeviceMeta(device: string) {
  const props = await Promise.all([
    adb(device, ["shell", "getprop", "ro.product.model"]).then((result) => result.stdout.trim()).catch(() => null),
    adb(device, ["shell", "getprop", "ro.build.version.release"]).then((result) => result.stdout.trim()).catch(() => null),
    adb(device, ["shell", "wm", "size"]).then((result) => result.stdout.trim()).catch(() => null),
    adb(device, ["shell", "dumpsys", "battery"]).then((result) => result.stdout).catch(() => null),
    adb(device, ["shell", "dumpsys", "package", packageName]).then((result) => result.stdout).catch(() => null)
  ]);
  return {
    model: props[0],
    android: props[1],
    screen_size: props[2],
    battery: summarizeBattery(props[3] ?? ""),
    package: summarizePackage(props[4] ?? "")
  };
}

async function step(
  name: string,
  run: () => Promise<{ ok: boolean; observations: Record<string, unknown>; note?: string }>,
  timeoutMs: number
): Promise<StepResult> {
  const startedAt = Date.now();
  try {
    const result = await withTimeout(run(), timeoutMs, `${name} timed out after ${timeoutMs}ms`);
    return { name, ok: result.ok, duration_ms: Date.now() - startedAt, observations: result.observations, note: result.note };
  } catch (error) {
    return {
      name,
      ok: false,
      duration_ms: Date.now() - startedAt,
      observations: {},
      note: error instanceof Error ? error.message : String(error)
    };
  }
}

async function dumpUi(device: string) {
  await adb(device, ["shell", "uiautomator", "dump", "/sdcard/skillsroom-window.xml"], { timeoutMs: 15_000 });
  const result = await adb(device, ["exec-out", "cat", "/sdcard/skillsroom-window.xml"], { timeoutMs: 15_000 });
  return result.stdout;
}

async function screenshot(device: string, outputPath: string) {
  const result = await adb(device, ["exec-out", "screencap", "-p"], { timeoutMs: 15_000, encoding: "buffer" });
  await writeFile(outputPath, Buffer.from(result.stdout, "binary"));
}

async function networkState(device: string) {
  const connectivity = await adb(device, ["shell", "dumpsys", "connectivity"], { timeoutMs: 15_000 }).then((result) => result.stdout).catch(() => "");
  return {
    wifi_connected: /WIFI\[[^\]]+\]\s+CONNECTED/i.test(connectivity),
    mobile_connected: /MOBILE\[[^\]]+\]\s+CONNECTED/i.test(connectivity),
    airplane_mode: await adb(device, ["shell", "cmd", "connectivity", "airplane-mode"], { timeoutMs: 10_000 }).then((result) => result.stdout.trim()).catch(() => null)
  };
}

function extractTextValues(xml: string) {
  const values: string[] = [];
  for (const match of xml.matchAll(/\btext=(["'])(.*?)\1/g)) {
    const value = match[2]
      .replace(/&#10;/g, "\n")
      .replace(/&quot;/g, "\"")
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, "&")
      .trim();
    if (value) values.push(value);
  }
  return values;
}

function includesText(values: string[], expected: string) {
  return values.some((value) => value.toLowerCase() === expected.toLowerCase());
}

async function openDeepLink(device: string, url: string) {
  await adb(device, ["shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", url, packageName], { timeoutMs: 15_000 });
}

async function launchApp(device: string) {
  await adb(device, ["shell", "am", "start", "-n", `${packageName}/.MainActivity`], { timeoutMs: 15_000 });
}

function summarizeLogs(logcat: string) {
  const lines = logcat.split(/\r?\n/);
  const important = lines
    .filter((line) => /ReactNativeJS|ReactNative|ReactHost|AndroidRuntime|FATAL EXCEPTION|Unable to load script|No bundle|Hermes|Expo|com\.skillsroom\.mobile/i.test(line))
    .filter((line) => !/AccessibilityNodeInfoDumper|C2MtkBufferManager|ActivityManager|getProcessesInErrorState/i.test(line));
  return {
    fatal_count: important.filter((line) => /FATAL EXCEPTION/i.test(line)).length,
    react_error_count: important.filter((line) => /ReactNative|ReactHost|Unable to load script|No bundle/i.test(line)).length,
    sample: important.slice(-40)
  };
}

async function sendHome(device: string) {
  await adb(device, ["shell", "input", "keyevent", "HOME"], { timeoutMs: 10_000 }).catch(async () => {
    await adb(device, ["shell", "am", "start", "-a", "android.intent.action.MAIN", "-c", "android.intent.category.HOME"], { timeoutMs: 10_000 });
  });
}

function summarizeMeminfo(meminfo: string) {
  const totalPss = /TOTAL PSS:\s+(\d+)/.exec(meminfo)?.[1] ?? /TOTAL\s+(\d+)/.exec(meminfo)?.[1] ?? null;
  const totalRss = /TOTAL RSS:\s+(\d+)/.exec(meminfo)?.[1] ?? null;
  return {
    total_pss_kb: totalPss ? Number(totalPss) : null,
    total_rss_kb: totalRss ? Number(totalRss) : null
  };
}

function summarizeGfxinfo(gfxinfo: string) {
  return {
    total_frames: numberAfter(gfxinfo, /Total frames rendered:\s+(\d+)/),
    janky_frames: numberAfter(gfxinfo, /Janky frames:\s+(\d+)/),
    p50_ms: numberAfter(gfxinfo, /50th percentile:\s+(\d+)ms/),
    p90_ms: numberAfter(gfxinfo, /90th percentile:\s+(\d+)ms/),
    p95_ms: numberAfter(gfxinfo, /95th percentile:\s+(\d+)ms/),
    p99_ms: numberAfter(gfxinfo, /99th percentile:\s+(\d+)ms/)
  };
}

function summarizeBattery(input: string) {
  return {
    level: numberAfter(input, /level:\s+(\d+)/i),
    powered_usb: /USB powered:\s+true/i.test(input),
    status: numberAfter(input, /status:\s+(\d+)/i)
  };
}

function summarizePackage(input: string) {
  return {
    version_name: /versionName=([^\s]+)/.exec(input)?.[1] ?? null,
    version_code: numberAfter(input, /versionCode=(\d+)/),
    debuggable: /DEBUGGABLE/.test(input),
    last_update_time: /lastUpdateTime=([^\r\n]+)/.exec(input)?.[1]?.trim() ?? null
  };
}

function numberAfter(input: string, regex: RegExp) {
  const value = regex.exec(input)?.[1];
  return value ? Number(value) : null;
}

function printReport(report: { ok: boolean; steps: StepResult[]; log_summary: ReturnType<typeof summarizeLogs>; artifacts: { dir: string } }, reportPath: string) {
  console.log(`chat real-device QA ${report.ok ? "passed" : "failed"}`);
  for (const item of report.steps) {
    console.log(`- ${item.ok ? "PASS" : "FAIL"} ${item.name} (${item.duration_ms}ms)${item.note ? `: ${item.note}` : ""}`);
  }
  console.log(`react log signals: ${report.log_summary.react_error_count}; fatal signals: ${report.log_summary.fatal_count}`);
  console.log(`artifacts: ${report.artifacts.dir}`);
  console.log(`report: ${reportPath}`);
}

async function adb(device: string, args: string[], options: { timeoutMs?: number; encoding?: BufferEncoding | "buffer" } = {}): Promise<ShellResult> {
  return adbRaw(["-s", device, ...args], options);
}

async function adbRaw(args: string[], options: { timeoutMs?: number; encoding?: BufferEncoding | "buffer" } = {}): Promise<ShellResult> {
  const encoding = options.encoding === "buffer" ? "buffer" : options.encoding ?? "utf8";
  const result = await execFileAsync(adbPath, args, {
    timeout: options.timeoutMs ?? 20_000,
    encoding,
    maxBuffer: 20 * 1024 * 1024
  });
  return {
    stdout: Buffer.isBuffer(result.stdout) ? result.stdout.toString("binary") : result.stdout,
    stderr: Buffer.isBuffer(result.stderr) ? result.stderr.toString("binary") : result.stderr
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
      })
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
