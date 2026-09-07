const BUILT_IN_TEMPLATES = [
  {
    id: "lecturer-poster",
    name: "教师节卡片",
    shortName: "教师节卡片",
    category: "可用模板",
    description: "基于教师卡设计稿生成教师节文字卡片，照片和表格内容按固定图层位置替换。",
    width: 2800,
    height: 1600,
    fields: ["teacherName", "course", "thanks", "blessing", "photo"],
    requiredFields: ["teacherName", "course", "thanks", "blessing"],
    outputPrefix: "教师节卡片",
    assets: {
      background: "./templates/teacher-day-card/assets/background.png?v=20260904-source-logo",
      overlay: "./templates/teacher-day-card/assets/overlay.png?v=20260904-source-nameplate",
    },
    text: {
      bodyFontSize: 44,
      bodyLineHeight: 60,
      nameFontSize: 64,
    },
  },
];

const state = {
  builtInTemplate: BUILT_IN_TEMPLATES[0],
  builtInAssets: {
    background: null,
    overlay: null,
  },
  builtInAssetRequest: 0,
  templateImage: null,
  sketchTemplate: null,
  templateFile: null,
  dataFile: null,
  photoFiles: [],
  templateFileName: BUILT_IN_TEMPLATES[0].name,
  photos: new Map(),
  originalPhotos: new Map(),
  photoRecords: [],
  mattedPhotoFiles: [],
  useMattedPhotos: false,
  avatar3dFiles: [],
  showAvatarOriginal: false,
  rows: [],
  headers: [],
  activeIndex: 0,
  isBatching: false,
  isMatting: false,
  isGeneratingAvatar3d: false,
  nativePreview: null,
  nativePreviewError: "",
  nativePreviewRequest: 0,
  nativePreviewTimer: null,
};

const canvas = document.getElementById("posterCanvas");
const ctx = canvas.getContext("2d");

const els = {
  workflowStatus: document.getElementById("workflowStatus"),
  templateModules: document.getElementById("templateModules"),
  templateName: document.getElementById("templateName"),
  templateInput: document.getElementById("templateInput"),
  templateDrop: document.getElementById("templateDrop"),
  templateMeta: document.getElementById("templateMeta"),
  dataInput: document.getElementById("dataInput"),
  dataDrop: document.getElementById("dataDrop"),
  dataMeta: document.getElementById("dataMeta"),
  dataPanel: document.getElementById("dataPanel"),
  photosInput: document.getElementById("photosInput"),
  photosDrop: document.getElementById("photosDrop"),
  photosMeta: document.getElementById("photosMeta"),
  photosPanel: document.getElementById("photosPanel"),
  mattingPanel: document.getElementById("mattingPanel"),
  mattingTolerance: document.getElementById("mattingTolerance"),
  mattingToleranceValue: document.getElementById("mattingToleranceValue"),
  mattingFeather: document.getElementById("mattingFeather"),
  mattingFeatherValue: document.getElementById("mattingFeatherValue"),
  removeWhiteBg: document.getElementById("removeWhiteBg"),
  mattingOriginal: document.getElementById("mattingOriginal"),
  downloadMattedPhotos: document.getElementById("downloadMattedPhotos"),
  downloadMattedPreview: document.getElementById("downloadMattedPreview"),
  mattingPrev: document.getElementById("mattingPrev"),
  mattingNext: document.getElementById("mattingNext"),
  mattingNotice: document.getElementById("mattingNotice"),
  avatar3dPanel: document.getElementById("avatar3dPanel"),
  avatarStyle: document.getElementById("avatarStyle"),
  generateAvatar3d: document.getElementById("generateAvatar3d"),
  avatarOriginal: document.getElementById("avatarOriginal"),
  avatarPrev: document.getElementById("avatarPrev"),
  avatarNext: document.getElementById("avatarNext"),
  downloadAvatarPreview: document.getElementById("downloadAvatarPreview"),
  downloadAvatarBatch: document.getElementById("downloadAvatarBatch"),
  avatar3dNotice: document.getElementById("avatar3dNotice"),
  generationNotice: document.getElementById("generationNotice"),
  outputPanel: document.getElementById("outputPanel"),
  prevPerson: document.getElementById("prevPerson"),
  nextPerson: document.getElementById("nextPerson"),
  downloadPreview: document.getElementById("downloadPreview"),
  batchProcess: document.getElementById("batchProcess"),
  previewTitle: document.getElementById("previewTitle"),
  personCounter: document.getElementById("personCounter"),
  peopleStrip: document.getElementById("peopleStrip"),
};

const sketchFieldNames = new Set(["name", "region", "title", "content", "photo"]);
const fixedFields = ["name", "region", "title", "content", "photo"];
const requiredFields = ["name", "region", "content"];
const fieldLabels = {
  name: "姓名",
  region: "所属大区",
  title: "模板标题",
  content: "海报文案",
  teacherName: "讲师姓名",
  course: "课程",
  thanks: "感谢语",
  blessing: "教师节祝福语",
  photo: "人物",
};
const headerAliases = new Map(
  Object.entries({
    姓名: "name",
    名字: "name",
    人员姓名: "name",
    name: "name",
    讲师姓名: "teacherName",
    讲师: "teacherName",
    教师姓名: "teacherName",
    teacherName: "teacherName",
    teacher_name: "teacherName",
    所属大区: "region",
    所属区域: "region",
    大区: "region",
    区域: "region",
    region: "region",
    职称: "title",
    标题: "title",
    title: "title",
    海报文案: "content",
    文案: "content",
    内容: "content",
    介绍: "content",
    content: "content",
    课程: "course",
    所授课程: "course",
    课程名称: "course",
    course: "course",
    感谢语: "thanks",
    感谢文案: "thanks",
    致谢语: "thanks",
    thanks: "thanks",
    教师节祝福语: "blessing",
    祝福语: "blessing",
    教师节文案: "blessing",
    blessing: "blessing",
    人物: "photo",
    人员照片: "photo",
    照片: "photo",
    图片: "photo",
    photo: "photo",
  }).map(([key, value]) => [normalizeAliasKey(key), value]),
);
const SELFIE_SEGMENTATION_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js";
const SELFIE_SEGMENTATION_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/";
const SOURCE_HAN_CN_FONT =
  '"Source Han Sans CN", "SourceHanSansCN", "思源黑体 CN", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif';
let selfieSegmentationInstance = null;

function currentWorkflow() {
  return state.builtInTemplate.workflow || "poster";
}

function currentFields() {
  return state.builtInTemplate.fields || fixedFields;
}

function currentRequiredFields() {
  return state.builtInTemplate.requiredFields || requiredFields;
}

function currentFieldText() {
  return currentFields().map(fieldLabel).join("、");
}

function fieldLabel(field) {
  return fieldLabels[field] || field;
}

function fieldLabelText(fields) {
  return fields.map(fieldLabel).join("、");
}

function drawPlaceholder() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBuiltInPoster({
    row: {},
    name: "姓名",
    region: "所属大区",
    title: state.builtInTemplate.staticTitle || "技术标杆",
    content: "上传人员信息表和人物图像后，系统会按每一行数据生成一张海报。",
    photo: null,
    isPlaceholder: true,
  });
}

function drawMattingWorkflowPreview() {
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#0b101a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(156, 170, 199, 0.28)";
  for (let y = 24; y < canvas.height; y += 18) {
    for (let x = 24; x < canvas.width; x += 18) {
      ctx.beginPath();
      ctx.arc(x, y, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const record = state.photoRecords[state.activeIndex];
  if (!record) {
    ctx.fillStyle = "rgba(246,248,252,0.95)";
    ctx.font = '800 38px system-ui, -apple-system, BlinkMacSystemFont, "Microsoft YaHei", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("上传白底照片后预览", canvas.width / 2, canvas.height / 2 - 24);
    ctx.fillStyle = "rgba(165,176,196,0.9)";
    ctx.font = '500 22px system-ui, -apple-system, BlinkMacSystemFont, "Microsoft YaHei", sans-serif';
    ctx.fillText("点击智能背景抠图后导出透明 PNG", canvas.width / 2, canvas.height / 2 + 30);
    ctx.restore();
    return;
  }

  const image = state.useMattedPhotos && record.mattedImage ? record.mattedImage : record.originalImage;
  const label = state.useMattedPhotos && record.mattedImage ? "透明图预览" : "原图预览";
  const frame = containImageMetrics(image, 54, 70, canvas.width - 108, canvas.height - 180);

  ctx.save();
  roundRect(ctx, frame.dx - 16, frame.dy - 16, frame.drawWidth + 32, frame.drawHeight + 32, 18);
  ctx.fillStyle = "rgba(15, 21, 33, 0.72)";
  ctx.fill();
  ctx.strokeStyle = "rgba(36,216,255,0.32)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.drawImage(image, frame.dx, frame.dy, frame.drawWidth, frame.drawHeight);
  ctx.restore();

  ctx.fillStyle = "rgba(246,248,252,0.95)";
  ctx.font = '800 24px system-ui, -apple-system, BlinkMacSystemFont, "Microsoft YaHei", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText(label, canvas.width / 2, canvas.height - 64);
  ctx.fillStyle = "rgba(165,176,196,0.9)";
  ctx.font = '500 16px system-ui, -apple-system, BlinkMacSystemFont, "Microsoft YaHei", sans-serif';
  ctx.fillText(record.file.name, canvas.width / 2, canvas.height - 36);
  ctx.restore();
}

function drawAvatar3dWorkflowPreview() {
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawAvatar3dBase();

  const record = state.photoRecords[state.activeIndex];
  if (!record) {
    drawAvatar3dEmptyState();
    ctx.restore();
    return;
  }

  const image = state.showAvatarOriginal || !record.avatar3dImage ? record.originalImage : record.avatar3dImage;
  const label = state.showAvatarOriginal || !record.avatar3dImage ? "原始头像" : styleLabel();
  drawAvatarImageOnCanvas(image);

  ctx.fillStyle = "rgba(14, 18, 29, 0.72)";
  roundRect(ctx, 64, canvas.height - 136, canvas.width - 128, 62, 18);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = '800 26px system-ui, -apple-system, BlinkMacSystemFont, "Microsoft YaHei", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, canvas.width / 2, canvas.height - 105);
  ctx.restore();
}

function drawAvatar3dBase() {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const glow = ctx.createRadialGradient(canvas.width * 0.36, canvas.height * 0.24, 30, canvas.width * 0.36, canvas.height * 0.24, 520);
  glow.addColorStop(0, "rgba(232, 241, 255, 0.92)");
  glow.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(245, 248, 255, 0.96)";
  roundRect(ctx, 72, 80, canvas.width - 144, canvas.height - 178, 36);
  ctx.fill();

  ctx.strokeStyle = "rgba(190, 204, 230, 0.72)";
  ctx.lineWidth = 2;
  roundRect(ctx, 72, 80, canvas.width - 144, canvas.height - 178, 36);
  ctx.stroke();
}

function drawAvatar3dEmptyState() {
  ctx.fillStyle = "rgba(124, 92, 255, 0.1)";
  roundRect(ctx, canvas.width / 2 - 118, 292, 236, 236, 118);
  ctx.fill();
  ctx.strokeStyle = "rgba(124, 92, 255, 0.24)";
  ctx.lineWidth = 3;
  roundRect(ctx, canvas.width / 2 - 118, 292, 236, 236, 118);
  ctx.stroke();

  ctx.fillStyle = "#101828";
  ctx.font = '900 38px system-ui, -apple-system, BlinkMacSystemFont, "Microsoft YaHei", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("上传头像后预览", canvas.width / 2, 618);
  ctx.fillStyle = "#667085";
  ctx.font = '500 24px system-ui, -apple-system, BlinkMacSystemFont, "Microsoft YaHei", sans-serif';
  ctx.fillText("生成比例 3:4，统一白色背景", canvas.width / 2, 662);
}

function drawAvatarImageOnCanvas(image) {
  ctx.save();
  ctx.shadowColor = "rgba(16, 24, 40, 0.16)";
  ctx.shadowBlur = 38;
  ctx.shadowOffsetY = 18;
  roundRect(ctx, 108, 112, canvas.width - 216, canvas.height - 260, 34);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.clip();
  drawContainImage(image, 108, 112, canvas.width - 216, canvas.height - 260);
  ctx.restore();
}

function setCanvasSize(width, height) {
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  canvas.style.aspectRatio = `${canvas.width} / ${canvas.height}`;
}

function drawPoster() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (currentWorkflow() === "matting") {
    drawMattingWorkflowPreview();
    updateChrome();
    return;
  }

  if (currentWorkflow() === "avatar3d") {
    drawAvatar3dWorkflowPreview();
    updateChrome();
    return;
  }

  if (state.builtInTemplate.comingSoon) {
    drawConstructionPlaceholder();
    updateChrome();
    return;
  }

  const row = state.rows[state.activeIndex] || {};
  const name = fixedValue(row, "name") || "姓名";
  const region = fixedValue(row, "region") || "所属大区";
  const title = state.builtInTemplate.staticTitle || fixedValue(row, "title") || "技术标杆";
  const content = fixedValue(row, "content") || "海报文案";
  const photo = findPersonPhoto(row);

  if (state.builtInTemplate.id === "lecturer-poster") {
    drawTeacherDayCard({ row, photo, isPlaceholder: !state.rows.length });
  } else {
    drawBuiltInPoster({ row, name, region, title, content, photo, isPlaceholder: !state.rows.length });
  }
  updateChrome();
  return;

  if (
    state.sketchTemplate &&
    state.nativePreview &&
    state.nativePreview.index === state.activeIndex &&
    state.nativePreview.image
  ) {
    ctx.drawImage(state.nativePreview.image, 0, 0, canvas.width, canvas.height);
    updateChrome();
    return;
  }

  if (state.sketchTemplate) {
    if (state.rows.length) {
      if (state.nativePreviewError) {
        drawNativePreviewError(state.nativePreviewError);
      } else {
        drawNativePreviewPending();
        scheduleNativePreview();
      }
      updateChrome();
    } else {
      drawSketchTemplate(state.sketchTemplate, { row, name, region, title, content, photo, replacementsEnabled: false });
      updateChrome();
    }
    return;
  }

  if (state.templateImage) {
    drawCoverImage(state.templateImage, 0, 0, canvas.width, canvas.height);
  } else {
    drawPlaceholder();
  }

  if (photo) {
    drawPhotoSlot(photo, 636, 132, 340, 500);
  }

  drawTextLayer({
    text: name,
    x: 86,
    y: 930,
    maxWidth: 620,
    fontSize: 72,
    weight: 800,
    color: "#ffffff",
    shadow: true,
  });

  drawTextLayer({
    text: title,
    x: 90,
    y: 1018,
    maxWidth: 760,
    fontSize: 34,
    weight: 700,
    color: "#ffffff",
    shadow: true,
  });

  drawTextLayer({
    text: region,
    x: 90,
    y: 1144,
    maxWidth: 840,
    fontSize: 42,
    weight: 800,
    color: "#182230",
    background: "rgba(255,255,255,0.88)",
  });

  drawWrappedTextLayer({
    text: content,
    x: 90,
    y: 1232,
    maxWidth: 820,
    fontSize: 30,
    weight: 600,
    color: "#344054",
    background: "rgba(255,255,255,0.78)",
    lineHeight: 40,
    maxLines: 3,
  });

  updateChrome();
}

function drawConstructionPlaceholder() {
  const template = state.builtInTemplate;
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#101827");
  gradient.addColorStop(0.52, "#0b111d");
  gradient.addColorStop(1, "#060911");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(36, 216, 255, 0.22)";
  ctx.lineWidth = 2;
  roundRect(ctx, 56, 56, canvas.width - 112, canvas.height - 112, 18);
  ctx.stroke();

  ctx.fillStyle = "rgba(36, 216, 255, 0.1)";
  roundRect(ctx, canvas.width / 2 - 44, canvas.height / 2 - 112, 88, 88, 22);
  ctx.fill();
  ctx.strokeStyle = "rgba(36, 216, 255, 0.42)";
  ctx.stroke();

  ctx.fillStyle = "#24d8ff";
  ctx.font = '800 46px system-ui, -apple-system, BlinkMacSystemFont, "Microsoft YaHei", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(template.addModule ? "+" : "建", canvas.width / 2, canvas.height / 2 - 68);

  ctx.fillStyle = "#f6f8fc";
  ctx.font = '900 32px system-ui, -apple-system, BlinkMacSystemFont, "Microsoft YaHei", sans-serif';
  ctx.fillText("正在建设中...", canvas.width / 2, canvas.height / 2 + 22);

  ctx.fillStyle = "rgba(219, 229, 247, 0.68)";
  ctx.font = '500 18px system-ui, -apple-system, BlinkMacSystemFont, "Microsoft YaHei", sans-serif';
  ctx.fillText(`${template.name} 模块后续开放`, canvas.width / 2, canvas.height / 2 + 62);
  ctx.restore();
}

function drawBuiltInPoster(options) {
  const { name, region, title, content, photo, isPlaceholder } = options;
  drawTemplateBackground();

  if (photo) {
    drawPersonPhoto(photo);
  } else {
    drawPhotoPlaceholder();
  }

  drawTemplateOverlay();
  drawHorizontalPosterText({ name, region, content, isPlaceholder });
}

function drawTeacherDayCard(options) {
  const { row, photo, isPlaceholder } = options;
  drawTemplateBackground();

  if (photo) {
    drawTeacherCardPhoto(photo);
  }

  drawTeacherCardText({
    name: fixedValue(row, "teacherName") || fixedValue(row, "name") || "讲师姓名",
    course: fixedValue(row, "course") || "所授课程：\n《课程一》《课程二》《课程三》",
    thanks: fixedValue(row, "thanks") || "上传教师节卡片表格后，这里会替换为每一位讲师的感谢语。",
    blessing: fixedValue(row, "blessing") || "教师节快乐，愿成就他人的你，也常被温柔以待。",
    isPlaceholder,
  });

  drawTemplateOverlay();

  drawTeacherCardName(fixedValue(row, "teacherName") || fixedValue(row, "name") || "讲师姓名");
}

function drawTeacherCardPhoto(photo) {
  ctx.save();
  const slot = { x: 299.56, y: 455, width: 583.89, height: 736 };
  ctx.beginPath();
  roundRect(ctx, slot.x, slot.y, slot.width, slot.height, 8);
  ctx.clip();
  drawContainBottomImage(photo, slot.x, slot.y, slot.width, slot.height);
  ctx.restore();
}

function drawContainBottomImage(image, x, y, width, height) {
  const scale = Math.min(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const dx = x + (width - drawWidth) / 2;
  const dy = y + height - drawHeight;
  ctx.drawImage(image, dx, dy, drawWidth, drawHeight);
}

function drawTeacherCardText(options) {
  const { course, thanks, blessing, isPlaceholder } = options;
  const textConfig = state.builtInTemplate.text || {};
  const fontSize = textConfig.bodyFontSize || 44;
  const lineHeight = textConfig.bodyLineHeight || 60;

  ctx.save();
  drawWrappedTextLayer({
    text: thanks,
    x: 1147,
    y: 442,
    maxWidth: 1250,
    fontSize,
    weight: "bold",
    fontFamily: SOURCE_HAN_CN_FONT,
    color: "#ffffff",
    lineHeight,
    maxLines: 3,
  });

  drawWrappedTextLayer({
    text: normalizeCourseText(course),
    x: 1147,
    y: 682,
    maxWidth: 1250,
    fontSize,
    weight: "bold",
    fontFamily: SOURCE_HAN_CN_FONT,
    color: "#ffffff",
    lineHeight,
    maxLines: 3,
  });

  drawWrappedTextLayer({
    text: blessing,
    x: 1147,
    y: 922,
    maxWidth: 1250,
    fontSize,
    weight: "bold",
    fontFamily: SOURCE_HAN_CN_FONT,
    color: "#ffffff",
    lineHeight,
    maxLines: 2,
  });
  ctx.restore();
}

function normalizeCourseText(value) {
  const text = String(value || "").trim();
  if (!text) return "所授课程：";
  if (/^所授课程[:：]/.test(text)) return text;
  return `所授课程：\n${text}`;
}

function drawTeacherCardName(name) {
  ctx.save();
  drawFittedSingleLineText({
    text: name || "讲师姓名",
    x: 294,
    y: 1110,
    width: 604,
    fontSize: (state.builtInTemplate.text || {}).nameFontSize || 64,
    minFontSize: 36,
    weight: 700,
    color: "#ffffff",
    align: "center",
  });
  ctx.restore();
}

function drawTemplateBackground() {
  if (state.builtInAssets.background) {
    ctx.drawImage(state.builtInAssets.background, 0, 0, canvas.width, canvas.height);
    return;
  }

  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#071534");
  gradient.addColorStop(0.42, "#0a1b46");
  gradient.addColorStop(1, "#06101f");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const beam = ctx.createRadialGradient(canvas.width / 2, 850, 20, canvas.width / 2, 850, 660);
  beam.addColorStop(0, "rgba(54, 221, 255, 0.78)");
  beam.addColorStop(0.16, "rgba(47, 111, 236, 0.32)");
  beam.addColorStop(1, "rgba(47, 111, 236, 0)");
  ctx.fillStyle = beam;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.globalAlpha = 0.34;
  for (let x = -80; x < canvas.width + 160; x += 68) {
    ctx.fillStyle = "rgba(57, 145, 255, 0.22)";
    ctx.fillRect(x, 660, 18, 260);
    ctx.fillStyle = "rgba(36, 216, 255, 0.14)";
    ctx.fillRect(x + 24, 610, 8, 320);
  }
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = "rgba(70, 172, 255, 0.32)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i += 1) {
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 855);
    ctx.bezierCurveTo(250 - i * 24, 610 - i * 28, 110 + i * 8, 380 - i * 12, 92 + i * 28, 185);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 855);
    ctx.bezierCurveTo(470 + i * 24, 610 - i * 28, 610 - i * 8, 380 - i * 12, 628 - i * 28, 185);
    ctx.stroke();
  }
  ctx.restore();

  const floor = ctx.createLinearGradient(0, 790, 0, 1080);
  floor.addColorStop(0, "rgba(19, 151, 255, 0)");
  floor.addColorStop(0.42, "rgba(19, 151, 255, 0.28)");
  floor.addColorStop(1, "rgba(8, 17, 35, 0.92)");
  ctx.fillStyle = floor;
  ctx.fillRect(0, 650, canvas.width, 430);

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  for (let y = 820; y < 1060; y += 28) {
    ctx.beginPath();
    ctx.moveTo(55, y);
    ctx.lineTo(665, y + (y - 820) * 0.1);
    ctx.stroke();
  }
}

function drawTemplateOverlay() {
  if (state.builtInAssets.overlay) {
    ctx.drawImage(state.builtInAssets.overlay, 0, 0, canvas.width, canvas.height);
  }
}

function drawPeakBrand() {
  ctx.save();
  ctx.translate(canvas.width / 2, 80);
  ctx.fillStyle = "rgba(255,255,255,0.94)";
  ctx.beginPath();
  ctx.moveTo(0, -30);
  ctx.lineTo(30, 0);
  ctx.lineTo(10, 0);
  ctx.lineTo(0, -12);
  ctx.lineTo(-10, 0);
  ctx.lineTo(-30, 0);
  ctx.closePath();
  ctx.fill();
  ctx.font = '900 42px system-ui, -apple-system, BlinkMacSystemFont, "Microsoft YaHei", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("贡献者极峰会", 0, 18);
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = '600 12px system-ui, -apple-system, BlinkMacSystemFont, "Microsoft YaHei", sans-serif';
  ctx.fillText("质 / 感 / 聚 / 能 / 成 / 就 / 增 / 长", 0, 68);
  ctx.restore();
}

function drawPersonPhoto(photo) {
  ctx.save();
  drawAlignedPersonPhoto(photo, 738.18, 60, 725.01, 1306);
  ctx.restore();
}

function drawAlignedPersonPhoto(photo, x, y, width, height) {
  const anchorPhoto = findAlignmentAnchorPhoto();
  const photoBounds = photo.__subjectBounds;
  const anchorBounds = anchorPhoto?.__subjectBounds;

  if (!photoBounds || !anchorBounds) {
    drawCoverImage(photo, x, y, width, height);
    return;
  }

  const current = coverImageMetrics(photo, x, y, width, height);
  const anchor = coverImageMetrics(anchorPhoto, x, y, width, height);
  const currentTop = current.dy + photoBounds.top * current.scale;
  const anchorTop = anchor.dy + anchorBounds.top * anchor.scale;

  ctx.drawImage(photo, current.dx, current.dy + anchorTop - currentTop, current.drawWidth, current.drawHeight);
}

function findAlignmentAnchorPhoto() {
  const anchorRow = state.rows.find((row) => String(fixedValue(row, "name")).includes("邢洪昌"));
  if (anchorRow) {
    const rowPhoto = findPersonPhoto(anchorRow);
    if (rowPhoto) return rowPhoto;
  }
  return state.photos.get(normalizeKey("邢洪昌"));
}

function drawPhotoPlaceholder() {
  ctx.save();
  const x = 738.18;
  const y = 60;
  const width = 725.01;
  const height = 1306;
  const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
  gradient.addColorStop(0, "rgba(255,255,255,0.14)");
  gradient.addColorStop(1, "rgba(36,216,255,0.06)");
  ctx.fillStyle = gradient;
  roundRect(ctx, x, y, width, height, 12);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, width, height, 12);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.font = '700 34px system-ui, -apple-system, BlinkMacSystemFont, "Microsoft YaHei", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("人物图像", x + width / 2, 420);
  ctx.fillStyle = "rgba(255,255,255,0.52)";
  ctx.font = '400 22px system-ui, -apple-system, BlinkMacSystemFont, "Microsoft YaHei", sans-serif';
  ctx.fillText("按人物或姓名字段自动匹配", x + width / 2, 462);
  ctx.restore();
}

function drawHorizontalPosterText(options) {
  const { name, region, content, isPlaceholder } = options;
  const textConfig = state.builtInTemplate.text || {};

  ctx.save();
  drawFittedSingleLineText({
    text: name || "姓名",
    x: 98.54,
    y: 261,
    width: textConfig.nameMaxWidth || 206,
    fontSize: textConfig.nameFontSize || 60,
    minFontSize: 34,
    weight: 800,
    color: "#ffffff",
    align: "center",
  });

  drawFittedSingleLineText({
    text: region || "所属大区",
    x: 81.7,
    y: 358.6,
    width: textConfig.regionMaxWidth || 514,
    fontSize: textConfig.regionFontSize || 36,
    minFontSize: 24,
    weight: 500,
    color: "#ffffff",
    align: "left",
  });

  drawWrappedTextLayer({
    text: content || "上传人员信息表后，这里会替换为每一行海报文案字段中的内容。",
    x: 81.7,
    y: 615,
    maxWidth: 714,
    fontSize: isPlaceholder ? 30 : textConfig.contentFontSize || 36,
    weight: 500,
    color: "#ffffff",
    lineHeight: textConfig.contentLineHeight || 56,
    maxLines: textConfig.contentMaxLines || 3,
  });
  ctx.restore();
}

function drawFittedSingleLineText(options) {
  const { text, x, y, width, fontSize, minFontSize, weight, color, align } = options;
  let fitted = fontSize;
  ctx.textBaseline = "top";
  ctx.textAlign = align === "center" ? "center" : align === "right" ? "right" : "left";
  ctx.font = `${weight} ${fitted}px system-ui, -apple-system, BlinkMacSystemFont, "Microsoft YaHei", sans-serif`;
  while (ctx.measureText(text).width > width && fitted > minFontSize) {
    fitted -= 2;
    ctx.font = `${weight} ${fitted}px system-ui, -apple-system, BlinkMacSystemFont, "Microsoft YaHei", sans-serif`;
  }
  const drawX = align === "center" ? x + width / 2 : align === "right" ? x + width : x;
  ctx.fillStyle = color;
  ctx.fillText(text, drawX, y, width);
}

function drawSideIdentity(name, region) {
  ctx.save();
  ctx.fillStyle = "#073b86";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = '800 17px system-ui, -apple-system, BlinkMacSystemFont, "Microsoft YaHei", sans-serif';
  drawVerticalFittedText(String(name || "姓名").replace(/\s+/g, ""), 603, 447, 76, 24, 25);
  ctx.fillStyle = "rgba(255,255,255,0.86)";
  ctx.font = '600 11px system-ui, -apple-system, BlinkMacSystemFont, "Microsoft YaHei", sans-serif';
  drawVerticalFittedText(String(region || "所属大区").replace(/\s+/g, ""), 564, 453, 132, 15, 22);
  ctx.restore();
}

function drawVerticalText(text, x, y, gap) {
  Array.from(text).forEach((char, index) => {
    ctx.fillText(char, x, y + index * gap);
  });
}

function drawVerticalFittedText(text, x, y, maxHeight, fontSize, preferredGap) {
  const chars = Array.from(String(text || ""));
  if (!chars.length) return;
  const gap = chars.length > 1 ? Math.min(preferredGap, maxHeight / (chars.length - 1)) : preferredGap;
  const fittedFont = Math.max(8, Math.min(fontSize, gap * 0.94));
  const weight = ctx.font.match(/^\s*([0-9]{3}|bold|normal|[a-z]+)\s+/i)?.[1] || 600;
  ctx.font = `${weight} ${fittedFont}px system-ui, -apple-system, BlinkMacSystemFont, "Microsoft YaHei", sans-serif`;
  drawVerticalText(chars.join(""), x, y, gap);
}

function drawInformationPanel(options) {
  const { title, content, isPlaceholder } = options;
  const textConfig = state.builtInTemplate.text || {};
  const titleFontSize = textConfig.titleFontSize || 32;
  const titleMaxWidth = textConfig.titleMaxWidth || 360;
  const contentFontSize = textConfig.contentFontSize || 16;
  const contentLineHeight = textConfig.contentLineHeight || 24;
  const contentMaxLines = textConfig.contentMaxLines || 4;
  ctx.save();
  drawTextLayer({
    text: title || "技术标杆",
    x: 66,
    y: 823,
    maxWidth: titleMaxWidth,
    fontSize: isPlaceholder ? Math.min(30, titleFontSize) : titleFontSize,
    weight: 800,
    color: "#ffffff",
  });

  drawWrappedTextLayer({
    text: content || "上传人员信息表后，这里会替换为每一行海报文案字段中的内容。",
    x: 66,
    y: 888,
    maxWidth: 603,
    fontSize: contentFontSize,
    weight: 500,
    color: "rgba(255,255,255,0.84)",
    lineHeight: contentLineHeight,
    maxLines: contentMaxLines,
  });
  ctx.restore();
}

function drawWrappedTextLayer(options) {
  const { text, x, y, maxWidth, fontSize, weight, color, background, lineHeight, maxLines, fontFamily } = options;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.font = `${weight} ${fontSize}px ${fontFamily || 'system-ui, -apple-system, BlinkMacSystemFont, "Microsoft YaHei", sans-serif'}`;

  const lines = wrapText(text, maxWidth, maxLines);
  if (background) {
    ctx.fillStyle = background;
    roundRect(ctx, x - 20, y - 14, maxWidth + 40, lines.length * lineHeight + 28, 8);
    ctx.fill();
  }

  ctx.fillStyle = color;
  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight, maxWidth);
  });
}

function drawNativePreviewPending() {
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#0b0f18";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#2d374b";
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
  ctx.fillStyle = "#141b28";
  ctx.fillRect(64, 64, canvas.width - 128, canvas.height - 128);
  ctx.strokeStyle = "#303b50";
  ctx.lineWidth = 2;
  ctx.strokeRect(64, 64, canvas.width - 128, canvas.height - 128);
  ctx.fillStyle = "#f6f8fc";
  ctx.font = "700 44px system-ui, -apple-system, BlinkMacSystemFont, \"Microsoft YaHei\", sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("等待源文件原生预览", canvas.width / 2, canvas.height / 2 - 32);
  ctx.fillStyle = "#a5b0c4";
  ctx.font = "400 26px system-ui, -apple-system, BlinkMacSystemFont, \"Microsoft YaHei\", sans-serif";
  ctx.fillText("当前预览会按源文件图层样式导出后显示", canvas.width / 2, canvas.height / 2 + 24);
  ctx.restore();
}

function drawNativePreviewError(message) {
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#120f0d";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#5f3a23";
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
  ctx.fillStyle = "#1c1511";
  ctx.fillRect(64, 64, canvas.width - 128, canvas.height - 128);
  ctx.strokeStyle = "#754723";
  ctx.lineWidth = 2;
  ctx.strokeRect(64, 64, canvas.width - 128, canvas.height - 128);
  ctx.fillStyle = "#ffb15f";
  ctx.font = "700 40px system-ui, -apple-system, BlinkMacSystemFont, \"Microsoft YaHei\", sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("本地服务未启动，无法生成源文件预览", canvas.width / 2, canvas.height / 2 - 70);
  ctx.fillStyle = "#f4c8a2";
  ctx.font = "500 24px system-ui, -apple-system, BlinkMacSystemFont, \"Microsoft YaHei\", sans-serif";
  ctx.fillText("请双击启动文件后刷新页面", canvas.width / 2, canvas.height / 2 - 20);
  ctx.font = "700 24px system-ui, -apple-system, BlinkMacSystemFont, \"Microsoft YaHei\", sans-serif";
  ctx.fillText("若仍失败，请确认本地服务已启动", canvas.width / 2, canvas.height / 2 + 20);
  ctx.fillStyle = "#ffb15f";
  ctx.font = "400 20px system-ui, -apple-system, BlinkMacSystemFont, \"Microsoft YaHei\", sans-serif";
  ctx.fillText(String(message || "").slice(0, 80), canvas.width / 2, canvas.height / 2 + 68);
  ctx.restore();
}

function drawSketchTemplate(template, values) {
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (template.previewImage) {
    ctx.drawImage(template.previewImage, 0, 0, canvas.width, canvas.height);
    if (values.replacementsEnabled && state.rows.length) {
      drawSketchReplacementChildren(template.root.layers || [], template, values, 0, 0);
    }
    ctx.restore();
    return;
  }

  const root = template.root;
  if (root.backgroundColor && root.hasBackgroundColor !== false) {
    ctx.fillStyle = sketchColor(root.backgroundColor, "#ffffff");
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  drawSketchChildren(root.layers || [], template, values, 0, 0);
  ctx.restore();
}

function drawSketchReplacementChildren(layers, template, values, offsetX, offsetY) {
  [...layers].reverse().forEach((layer) => {
    drawSketchReplacementLayer(layer, template, values, offsetX, offsetY);
  });
}

function drawSketchReplacementLayer(layer, template, values, offsetX, offsetY) {
  if (!layer || layer.isVisible === false) return;

  const frame = layer.frame || {};
  const x = offsetX + Number(frame.x || 0);
  const y = offsetY + Number(frame.y || 0);
  const width = Math.max(0, Number(frame.width || 0));
  const height = Math.max(0, Number(frame.height || 0));
  const layerName = sketchFieldNameFromLayer(layer.name);

  ctx.save();
  const opacity = layer.style?.contextSettings?.opacity ?? layer.style?.opacity ?? layer.opacity;
  if (opacity !== undefined) ctx.globalAlpha *= Number(opacity);

  if (typeof layer.rotation === "number" && layer.rotation !== 0) {
    ctx.translate(x + width / 2, y + height / 2);
    ctx.rotate((-layer.rotation * Math.PI) / 180);
    ctx.translate(-x - width / 2, -y - height / 2);
  }

  if (layerName === "photo") {
    drawSketchPhoto(values.photo, x, y, width, height, layer);
  } else if (sketchFieldNames.has(layerName)) {
    eraseSketchLayerArea(layer, x, y, width, height);
    drawSketchText(layer, values, x, y, width, height, layerName);
  }

  if (Array.isArray(layer.layers)) {
    drawSketchReplacementChildren(layer.layers, template, values, x, y);
  }

  ctx.restore();
}

function eraseSketchLayerArea(layer, x, y, width, height) {
  if (width <= 0 || height <= 0) return;

  const padding = Math.max(4, Math.round(Math.min(width, height) * 0.04));
  const fill = sampleCanvasColor(x - padding, y - padding, width + padding * 2, height + padding * 2);
  ctx.fillStyle = fill;
  sketchPath(ctx, layer, x - padding, y - padding, width + padding * 2, height + padding * 2);
  ctx.fill();
}

function sampleCanvasColor(x, y, width, height) {
  const sampleX = Math.min(canvas.width - 1, Math.max(0, Math.round(x + width / 2)));
  const sampleY = Math.min(canvas.height - 1, Math.max(0, Math.round(y + height / 2)));
  try {
    const [red, green, blue, alpha] = ctx.getImageData(sampleX, sampleY, 1, 1).data;
    return `rgba(${red}, ${green}, ${blue}, ${alpha / 255})`;
  } catch {
    return "#ffffff";
  }
}

function drawSketchChildren(layers, template, values, offsetX, offsetY) {
  [...layers].reverse().forEach((layer) => {
    drawSketchLayer(layer, template, values, offsetX, offsetY);
  });
}

function drawSketchLayer(layer, template, values, offsetX, offsetY) {
  if (!layer || layer.isVisible === false) return;

  const frame = layer.frame || {};
  const x = offsetX + Number(frame.x || 0);
  const y = offsetY + Number(frame.y || 0);
  const width = Math.max(0, Number(frame.width || 0));
  const height = Math.max(0, Number(frame.height || 0));
  const className = layer._class || layer.class || "";
  const layerName = sketchFieldNameFromLayer(layer.name);

  ctx.save();
  const opacity = layer.style?.contextSettings?.opacity ?? layer.style?.opacity ?? layer.opacity;
  if (opacity !== undefined) ctx.globalAlpha *= Number(opacity);

  if (typeof layer.rotation === "number" && layer.rotation !== 0) {
    ctx.translate(x + width / 2, y + height / 2);
    ctx.rotate((-layer.rotation * Math.PI) / 180);
    ctx.translate(-x - width / 2, -y - height / 2);
  }

  if (className === "text") {
    drawSketchText(layer, { ...values, replacementsEnabled: false }, x, y, width, height, layerName);
  } else if (layerName === "photo") {
    drawSketchPhoto(values.replacementsEnabled ? values.photo : null, x, y, width, height, layer);
  } else if (className === "bitmap") {
    drawSketchBitmap(layer, template, x, y, width, height);
  } else {
    drawSketchShape(layer, template, x, y, width, height);
  }

  if (Array.isArray(layer.layers)) {
    drawSketchChildren(layer.layers, template, values, x, y);
  }

  ctx.restore();
}

function drawSketchText(layer, values, x, y, width, height, layerName) {
  const rawText = getSketchText(layer);
  const replacement = values.replacementsEnabled && sketchFieldNames.has(layerName) ? values[layerName] : rawText;
  const text = String(replacement || rawText || "");
  const textStyle = sketchTextAttributes(layer);
  const font = textStyle.MSAttributedStringFontAttribute || {};
  const fontAttrs = font.attributes || font;
  const fontSize = Number(fontAttrs.size || layer.frame?.height || 28);
  const fontName = fontAttrs.name || fontAttrs.family || "";
  const fontWeight = sketchFontWeight(fontName, fontAttrs);
  const color = sketchColor(textStyle.MSAttributedStringColorAttribute, "#ffffff");
  const paragraph = textStyle.paragraphStyle || textStyle.NSParagraphStyle || {};
  const alignment = ["left", "right", "center", "justify"][Number(paragraph.alignment || 0)] || "left";
  const lineHeight = Number(
    paragraph.maximumLineHeight ||
      paragraph.minimumLineHeight ||
      textStyle.MSAttributedStringLineHeightAttribute ||
      fontSize * 1.22,
  );

  ctx.fillStyle = color;
  ctx.textAlign = alignment === "right" ? "right" : alignment === "center" ? "center" : "left";
  ctx.textBaseline = "top";
  ctx.font = `${fontWeight} ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Microsoft YaHei", sans-serif`;

  const drawX = alignment === "right" ? x + width : alignment === "center" ? x + width / 2 : x;
  const lines = wrapText(text, width || canvas.width, Math.max(1, Math.floor((height || lineHeight) / lineHeight)));
  lines.forEach((line, index) => {
    ctx.fillText(line, drawX, y + index * lineHeight, width || canvas.width);
  });
}

function sketchTextAttributes(layer) {
  const encoded = layer.style?.textStyle?.encodedAttributes || {};
  const attributed = layer.attributedString?.attributes || [];
  const firstRun = attributed.find((run) => run?.attributes)?.attributes || {};
  return { ...encoded, ...firstRun };
}

function sketchFontWeight(fontName, fontAttrs) {
  const traits = String(fontAttrs.traits || fontAttrs.style || fontName || "").toLowerCase();
  if (traits.match(/heavy|black|extrabold|extra bold/)) return 900;
  if (traits.match(/bold|semibold|semi bold|demibold|demi bold/)) return 800;
  if (traits.match(/medium/)) return 600;
  if (traits.match(/light|thin/)) return 300;
  return 500;
}

function drawSketchPhoto(photo, x, y, width, height, layer) {
  drawSketchShape(layer, null, x, y, width, height);
  if (!photo || width <= 0 || height <= 0) return;

  ctx.save();
  const radius = sketchCornerRadius(layer);
  roundRect(ctx, x, y, width, height, radius);
  ctx.clip();
  drawCoverImage(photo, x, y, width, height);
  ctx.restore();
}

function drawSketchBitmap(layer, template, x, y, width, height) {
  const image = findSketchImage(layer, template);
  if (image) {
    drawCoverImage(image, x, y, width, height);
    return;
  }
  drawSketchShape(layer, template, x, y, width, height);
}

function drawSketchShape(layer, template, x, y, width, height) {
  if (width <= 0 || height <= 0) return;

  const fill = firstEnabled(layer.style?.fills);
  if (template && fill?.image) {
    const image = findSketchImage({ style: { fills: [fill] } }, template);
    if (image) {
      drawCoverImage(image, x, y, width, height);
      return;
    }
  }

  if (fill?.color) {
    ctx.fillStyle = sketchColor(fill.color, "transparent");
    sketchPath(ctx, layer, x, y, width, height);
    ctx.fill();
  }

  const border = firstEnabled(layer.style?.borders);
  if (border?.color && Number(border.thickness || 1) > 0) {
    ctx.strokeStyle = sketchColor(border.color, "#000000");
    ctx.lineWidth = Number(border.thickness || 1);
    sketchPath(ctx, layer, x, y, width, height);
    ctx.stroke();
  }
}

function sketchPath(context, layer, x, y, width, height) {
  const kind = sketchShapeKind(layer);
  context.beginPath();
  if (kind === "oval") {
    context.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
    context.closePath();
    return;
  }
  roundRect(context, x, y, width, height, sketchCornerRadius(layer));
}

function sketchShapeKind(layer) {
  const className = layer._class || layer.class || "";
  if (className === "oval") return "oval";
  if ((layer.layers || []).some((child) => (child._class || child.class) === "oval")) return "oval";
  return "rect";
}

function firstEnabled(items = []) {
  return items.find((item) => item && item.isEnabled !== false);
}

function sketchCornerRadius(layer) {
  const points = layer.layers?.flatMap((child) => child.points || []) || layer.points || [];
  const radii = points.map((point) => Number(point.cornerRadius || 0)).filter((radius) => radius > 0);
  return radii[0] || Number(layer.fixedRadius || 0) || 0;
}

function sketchColor(color, fallback) {
  if (!color) return fallback;
  const red = Math.round(Number(color.red || 0) * 255);
  const green = Math.round(Number(color.green || 0) * 255);
  const blue = Math.round(Number(color.blue || 0) * 255);
  const alpha = color.alpha === undefined ? 1 : Number(color.alpha);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function getSketchText(layer) {
  return layer.attributedString?.string || layer.stringValue || layer.name || "";
}

function normalizeLayerName(name) {
  return String(name || "").trim().toLowerCase();
}

function sketchFieldNameFromLayer(name) {
  const normalized = normalizeLayerName(name)
    .replace(/[{}]/g, "")
    .replace(/\s+copy(?:\s+\d+)?$/i, "")
    .replace(/\s+\d+$/i, "")
    .trim();

  if (sketchFieldNames.has(normalized)) return normalized;

  const token = normalized.split(/[\s/_-]+/).find((part) => sketchFieldNames.has(part));
  return token || normalized;
}

function findSketchImage(layer, template) {
  const refs = [
    layer.image?._ref,
    layer.image?.sha1,
    layer.image?.id,
    firstEnabled(layer.style?.fills)?.image?._ref,
    firstEnabled(layer.style?.fills)?.image?.sha1,
  ].filter(Boolean);

  for (const ref of refs) {
    const key = normalizeImageKey(ref);
    if (template.images.has(key)) return template.images.get(key);
  }
  return null;
}

function normalizeImageKey(value) {
  return String(value || "")
    .trim()
    .replace(/^.*[\\/]/, "")
    .replace(/\.[^.]+$/, "")
    .toLowerCase();
}

function wrapText(text, maxWidth, maxLines) {
  const chars = Array.from(String(text));
  const lines = [];
  let line = "";

  chars.forEach((char) => {
    const next = `${line}${char}`;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = char;
    } else {
      line = next;
    }
  });

  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = `${lines[maxLines - 1].slice(0, Math.max(0, lines[maxLines - 1].length - 1))}...`;
  }
  return lines.length ? lines : [""];
}

function drawPhotoSlot(img, x, y, width, height) {
  ctx.save();
  roundRect(ctx, x, y, width, height, 8);
  ctx.clip();
  drawCoverImage(img, x, y, width, height);
  ctx.restore();

  ctx.strokeStyle = "rgba(255,255,255,0.82)";
  ctx.lineWidth = 6;
  roundRect(ctx, x + 3, y + 3, width - 6, height - 6, 8);
  ctx.stroke();
}

function drawCoverImage(img, x, y, width, height) {
  const { dx, dy, drawWidth, drawHeight } = coverImageMetrics(img, x, y, width, height);
  ctx.drawImage(img, dx, dy, drawWidth, drawHeight);
}

function drawContainImage(img, x, y, width, height) {
  const { dx, dy, drawWidth, drawHeight } = containImageMetrics(img, x, y, width, height);
  ctx.drawImage(img, dx, dy, drawWidth, drawHeight);
}

function containImageMetrics(img, x, y, width, height) {
  const scale = Math.min(width / img.width, height / img.height);
  const drawWidth = img.width * scale;
  const drawHeight = img.height * scale;
  const dx = x + (width - drawWidth) / 2;
  const dy = y + (height - drawHeight) / 2;
  return { scale, drawWidth, drawHeight, dx, dy };
}

function coverImageMetrics(img, x, y, width, height) {
  const scale = Math.max(width / img.width, height / img.height);
  const drawWidth = img.width * scale;
  const drawHeight = img.height * scale;
  const dx = x + (width - drawWidth) / 2;
  const dy = y + (height - drawHeight) / 2;
  return { scale, drawWidth, drawHeight, dx, dy };
}

function drawTextLayer(options) {
  const { text, x, y, maxWidth, fontSize, weight, color, shadow, background } = options;
  let fitted = fontSize;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.font = `${weight} ${fitted}px system-ui, -apple-system, BlinkMacSystemFont, "Microsoft YaHei", sans-serif`;

  while (ctx.measureText(text).width > maxWidth && fitted > 18) {
    fitted -= 2;
    ctx.font = `${weight} ${fitted}px system-ui, -apple-system, BlinkMacSystemFont, "Microsoft YaHei", sans-serif`;
  }

  if (background) {
    const metrics = ctx.measureText(text);
    ctx.fillStyle = background;
    roundRect(ctx, x - 20, y - 14, Math.min(metrics.width + 40, maxWidth + 40), fitted + 30, 8);
    ctx.fill();
  }

  if (shadow) {
    ctx.shadowColor = "rgba(0,0,0,0.34)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 4;
  }

  ctx.fillStyle = color;
  ctx.fillText(text, x, y, maxWidth);
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && insideQuotes && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function tableToObjects(table) {
  const [rawHeaders = [], ...body] = table;
  const headers = rawHeaders.map((header) => normalizeHeader(header));
  return {
    headers,
    rows: body.map((cells) =>
      headers.reduce((acc, header, index) => {
        acc[header] = cells[index] || "";
        return acc;
      }, {}),
    ),
  };
}

async function parseXlsx(arrayBuffer) {
  const entries = await unzipFiles(arrayBuffer);
  const workbookXml = textFromEntry(entries, "xl/workbook.xml");
  const relsXml = textFromEntry(entries, "xl/_rels/workbook.xml.rels");
  const sharedStringsXml = textFromEntry(entries, "xl/sharedStrings.xml", true);
  const sharedStrings = sharedStringsXml ? parseSharedStrings(sharedStringsXml) : [];
  const sheetPath = firstSheetPath(workbookXml, relsXml);
  const sheetXml = textFromEntry(entries, sheetPath);
  return parseSheetXml(sheetXml, sharedStrings);
}

async function parseSketchTemplate(arrayBuffer) {
  const entries = await unzipFiles(arrayBuffer);
  const pagePaths = Array.from(entries.keys()).filter((path) => path.startsWith("pages/") && path.endsWith(".json"));
  if (!pagePaths.length) throw new Error("源文件没有可读取的页面");

  const pages = pagePaths.map((path) => JSON.parse(textFromEntry(entries, path)));
  const root = findSketchArtboard(pages) || buildSketchRootFromPage(pages[0]);
  const width = Math.max(1, Math.round(Number(root.frame?.width || 1080)));
  const height = Math.max(1, Math.round(Number(root.frame?.height || 1440)));
  const images = await loadSketchImages(entries);
  const previewImage = await loadSketchPreviewImage(entries);
  const targets = collectSketchReplacementTargets(root);

  return { root, width, height, images, previewImage, targets };
}

function collectSketchReplacementTargets(root) {
  const counts = Object.fromEntries(fixedFields.map((field) => [field, 0]));

  function visit(layer) {
    const fieldName = sketchFieldNameFromLayer(layer?.name);
    if (sketchFieldNames.has(fieldName)) counts[fieldName] += 1;
    (layer?.layers || []).forEach(visit);
  }

  visit(root);
  return counts;
}

function formatSketchTargets(targets) {
  return fixedFields.map((field) => `${fieldLabel(field)}：${targets?.[field] || 0}`).join(" ");
}

function missingExcelFields() {
  const headerSet = new Set(state.headers);
  return currentRequiredFields().filter((field) => !headerSet.has(field));
}

function findSketchArtboard(pages) {
  for (const page of pages) {
    const found = findLayer(page, (layer) => (layer._class || layer.class) === "artboard");
    if (found) return found;
  }
  return null;
}

function findLayer(layer, predicate) {
  if (predicate(layer)) return layer;
  for (const child of layer.layers || []) {
    const found = findLayer(child, predicate);
    if (found) return found;
  }
  return null;
}

function buildSketchRootFromPage(page) {
  const bounds = layerBounds(page.layers || []);
  return {
    ...page,
    frame: { x: 0, y: 0, width: bounds.width || 1080, height: bounds.height || 1440 },
    layers: page.layers || [],
  };
}

function layerBounds(layers) {
  const frames = layers.map((layer) => layer.frame || {}).filter((frame) => frame.width && frame.height);
  if (!frames.length) return { width: 1080, height: 1440 };
  const minX = Math.min(...frames.map((frame) => Number(frame.x || 0)));
  const minY = Math.min(...frames.map((frame) => Number(frame.y || 0)));
  const maxX = Math.max(...frames.map((frame) => Number(frame.x || 0) + Number(frame.width || 0)));
  const maxY = Math.max(...frames.map((frame) => Number(frame.y || 0) + Number(frame.height || 0)));
  return { width: maxX - minX, height: maxY - minY };
}

async function loadSketchImages(entries) {
  const images = new Map();
  const imageEntries = Array.from(entries.entries()).filter(([path]) => path.startsWith("images/"));

  await Promise.all(
    imageEntries.map(async ([path, bytes]) => {
      const mime = mimeFromPath(path);
      if (!mime) return;
      const image = await loadImageFromBlob(new Blob([bytes], { type: mime }));
      const key = normalizeImageKey(path);
      images.set(key, image);
    }),
  );

  return images;
}

async function loadSketchPreviewImage(entries) {
  const previewEntries = Array.from(entries.entries()).filter(([path]) => {
    const lower = path.toLowerCase();
    return (
      (lower.startsWith("previews/") || lower.includes("/previews/") || lower.includes("preview")) &&
      Boolean(mimeFromPath(path))
    );
  });

  const preferred = previewEntries.find(([path]) => path.toLowerCase().endsWith("preview.png")) || previewEntries[0];
  if (!preferred) return null;

  const [path, bytes] = preferred;
  return loadImageFromBlob(new Blob([bytes], { type: mimeFromPath(path) }));
}

function mimeFromPath(path) {
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  return "";
}

function loadImageFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(blob);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("图片资源加载失败"));
    };
    image.src = url;
  });
}

async function unzipFiles(arrayBuffer) {
  const data = new Uint8Array(arrayBuffer);
  const entries = new Map();
  const centralDirectory = findCentralDirectory(data);
  let offset = centralDirectory.offset;
  const end = centralDirectory.offset + centralDirectory.size;

  while (offset + 46 <= end) {
    const view = new DataView(data.buffer, data.byteOffset + offset);
    const signature = view.getUint32(0, true);
    if (signature !== 0x02014b50) break;

    const method = view.getUint16(10, true);
    const compressedSize = view.getUint32(20, true);
    const fileNameLength = view.getUint16(28, true);
    const extraLength = view.getUint16(30, true);
    const commentLength = view.getUint16(32, true);
    const localHeaderOffset = view.getUint32(42, true);
    const nameStart = offset + 46;
    const nameEnd = nameStart + fileNameLength;
    const name = new TextDecoder().decode(data.slice(nameStart, nameEnd));

    const localView = new DataView(data.buffer, data.byteOffset + localHeaderOffset);
    if (localView.getUint32(0, true) !== 0x04034b50) throw new Error(`压缩包读取失败：${name}`);

    const localNameLength = localView.getUint16(26, true);
    const localExtraLength = localView.getUint16(28, true);
    const contentStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const contentEnd = contentStart + compressedSize;

    const compressed = data.slice(contentStart, contentEnd);
    let content;
    if (method === 0) {
      content = compressed;
    } else if (method === 8 && "DecompressionStream" in window) {
      const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      content = new Uint8Array(await new Response(stream).arrayBuffer());
    } else {
      throw new Error("当前浏览器无法解压这个表格文件，请使用新版浏览器打开");
    }

    entries.set(name, content);
    offset = nameEnd + extraLength + commentLength;
  }

  return entries;
}

function findCentralDirectory(data) {
  const minimumOffset = Math.max(0, data.length - 22 - 65535);
  for (let offset = data.length - 22; offset >= minimumOffset; offset -= 1) {
    const view = new DataView(data.buffer, data.byteOffset + offset);
    if (view.getUint32(0, true) === 0x06054b50) {
      return {
        size: view.getUint32(12, true),
        offset: view.getUint32(16, true),
      };
    }
  }
  throw new Error("文件不是有效的压缩包、源文件或表格格式");
}

function textFromEntry(entries, path, optional = false) {
  const data = entries.get(path);
  if (!data && optional) return "";
  if (!data) throw new Error(`表格文件缺少 ${path}`);
  return new TextDecoder("utf-8").decode(data);
}

function parseSharedStrings(xml) {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  return Array.from(doc.getElementsByTagName("si")).map((item) =>
    Array.from(item.getElementsByTagName("t"))
      .map((node) => node.textContent || "")
      .join(""),
  );
}

function firstSheetPath(workbookXml, relsXml) {
  const workbookDoc = new DOMParser().parseFromString(workbookXml, "application/xml");
  const firstSheet = workbookDoc.getElementsByTagName("sheet")[0];
  if (!firstSheet) throw new Error("表格文件没有工作表");

  const relationId =
    firstSheet.getAttribute("r:id") ||
    firstSheet.getAttribute("id") ||
    firstSheet.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
  if (!relationId) return "xl/worksheets/sheet1.xml";

  const relsDoc = new DOMParser().parseFromString(relsXml, "application/xml");
  const relation = Array.from(relsDoc.getElementsByTagName("Relationship")).find(
    (item) => item.getAttribute("Id") === relationId,
  );
  const target = relation?.getAttribute("Target") || "worksheets/sheet1.xml";
  if (target.startsWith("/")) return target.slice(1);
  return `xl/${target}`.replace(/\/[^/]+\/\.\.\//g, "/");
}

function parseSheetXml(xml, sharedStrings) {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  return Array.from(doc.getElementsByTagName("row")).map((row) => {
    const cells = [];
    Array.from(row.getElementsByTagName("c")).forEach((cell) => {
      const ref = cell.getAttribute("r") || "";
      const columnIndex = columnNameToIndex(ref.replace(/\d+/g, ""));
      const type = cell.getAttribute("t");
      const valueNode = cell.getElementsByTagName("v")[0];
      const inlineNode = cell.getElementsByTagName("t")[0];
      let value = valueNode?.textContent || inlineNode?.textContent || "";

      if (type === "s") value = sharedStrings[Number(value)] || "";
      if (type === "inlineStr") value = inlineNode?.textContent || "";

      cells[columnIndex] = value.trim();
    });
    return cells.map((cell) => cell || "");
  });
}

function columnNameToIndex(columnName) {
  if (!columnName) return 0;
  return columnName.split("").reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0) - 1;
}

function valueFrom(row, key) {
  if (!key || key === "__none") return "";
  return row[key] || "";
}

function fixedValue(row, field) {
  const canonical = normalizeHeader(field);
  return row[field] || row[canonical] || "";
}

function displayNameForRow(row, index = 0) {
  return fixedValue(row, "teacherName") || fixedValue(row, "name") || `第 ${index + 1} 位`;
}

function normalizeHeader(header) {
  const normalized = normalizeAliasKey(header);
  return headerAliases.get(normalized) || normalized;
}

function normalizeAliasKey(value) {
  return String(value || "")
    .trim()
    .replace(/[{}]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function renderTemplateModules() {
  if (!els.templateModules) return;

  els.templateModules.innerHTML = "";
  BUILT_IN_TEMPLATES.forEach((template) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = [
      "template-module",
      template.id === state.builtInTemplate.id ? "active" : "",
      template.comingSoon ? "coming-soon" : "",
      template.addModule ? "add-module" : "",
    ]
      .filter(Boolean)
      .join(" ");
    button.dataset.templateId = template.id;
    const fieldText = template.workflow === "matting"
      ? "纯色背景、透明 PNG"
      : template.workflow === "avatar3d"
      ? "头像、3:4、白底"
      : template.comingSoon
      ? template.addModule
        ? "后续可添加不同模板"
        : "正在建设中"
      : fieldLabelText((template.fields || []).filter((field) => field !== "photo"));
    button.innerHTML = `
      <span class="module-category">${escapeHtml(template.category || "模板模块")}</span>
      <span class="module-name">${escapeHtml(template.shortName || template.name)}</span>
      <span class="module-fields">${escapeHtml(fieldText)}</span>
    `;
    button.addEventListener("click", () => selectBuiltInTemplate(template.id));
    els.templateModules.appendChild(button);
  });
}

function selectBuiltInTemplate(templateId) {
  const nextTemplate = BUILT_IN_TEMPLATES.find((template) => template.id === templateId);
  if (!nextTemplate || nextTemplate.id === state.builtInTemplate.id) return;

  clearNativePreview();
  state.builtInTemplate = nextTemplate;
  state.templateFileName = nextTemplate.name;
  state.builtInAssets = { background: null, overlay: null };
  state.activeIndex = 0;
  state.showAvatarOriginal = false;
  rebuildPhotoMap();
  setCanvasSize(nextTemplate.width, nextTemplate.height);
  renderTemplateModules();
  updateWorkflowPanels();
  updateTemplateDetail();
  updateDataRequirementText();
  drawPoster();
  if (nextTemplate.comingSoon) return;
  if (currentWorkflow() !== "poster") return;
  loadBuiltInAssets();
}

function updateTemplateDetail() {
  if (els.templateName) {
    els.templateName.textContent = state.builtInTemplate.name;
  }
  if (els.templateMeta) {
    els.templateMeta.textContent = state.builtInTemplate.comingSoon
      ? `${state.builtInTemplate.description}`
      : `${state.builtInTemplate.description} · 字段：${currentFieldText()}`;
  }
}

function updateDataRequirementText() {
  if (!els.dataMeta) return;

  if (!state.dataFile) {
    if (state.builtInTemplate.comingSoon) {
      els.dataMeta.textContent = "当前模板正在建设中，暂不需要上传表格";
      return;
    }
    els.dataMeta.textContent = `支持表格文件，当前模板字段：${currentFieldText()}`;
    return;
  }

  if (state.builtInTemplate.comingSoon) {
    els.dataMeta.textContent = `${state.dataFile.name} 已加载，当前模板正在建设中`;
    return;
  }

  const missing = missingExcelFields();
  els.dataMeta.textContent = missing.length
    ? `${state.dataFile.name} · ${state.rows.length} 条记录 · 缺少字段：${fieldLabelText(missing)}`
    : `${state.dataFile.name} · ${state.rows.length} 条记录 · 当前模板字段已匹配`;
}

function updateWorkflowPanels() {
  const workflow = currentWorkflow();
  const isTeacherDayCard = state.builtInTemplate.id === "lecturer-poster";
  [els.dataPanel, els.photosPanel, els.mattingPanel, els.avatar3dPanel, els.outputPanel].forEach((panel) => {
    if (!panel) return;
    const workflows = String(panel.dataset.workflowPanel || "").split(/\s+/);
    const shouldShow = !state.builtInTemplate.comingSoon && workflows.includes(workflow);
    panel.classList.toggle("is-hidden", !shouldShow);
    panel.hidden = !shouldShow;
    panel.style.order = "";
  });
  if (els.dataPanel) els.dataPanel.style.order = isTeacherDayCard ? "2" : "";
  if (els.photosPanel) els.photosPanel.style.order = isTeacherDayCard ? "3" : "";
  if (els.outputPanel) els.outputPanel.style.order = isTeacherDayCard ? "4" : "";
  updateDataPanelText();
  updatePhotoPanelText();
}

function updateDataPanelText() {
  if (!els.dataPanel) return;
  const heading = els.dataPanel.querySelector("h2");
  const title = els.dataPanel.querySelector(".drop-title");
  const kicker = els.dataPanel.querySelector(".drop-kicker");
  const step = els.dataPanel.querySelector(".step-index");
  if (state.builtInTemplate.id === "lecturer-poster") {
    if (step) step.textContent = "2";
    if (heading) heading.textContent = "教师节卡片表格";
    if (kicker) kicker.textContent = "表格";
    if (title) title.textContent = "选择教师节卡片表格";
    return;
  }
  if (step) step.textContent = "2";
  if (heading) heading.textContent = "人员信息表";
  if (kicker) kicker.textContent = "数据";
  if (title) title.textContent = "选择人员信息表";
}

function updatePhotoPanelText() {
  if (!els.photosPanel) return;
  const heading = els.photosPanel.querySelector("h2");
  const title = els.photosPanel.querySelector(".drop-title");
  const kicker = els.photosPanel.querySelector(".drop-kicker");
  const step = els.photosPanel.querySelector(".step-index");
  if (state.builtInTemplate.id === "lecturer-poster") {
    if (step) step.textContent = "3";
    if (heading) heading.textContent = "讲师照片";
    if (kicker) kicker.textContent = "照片";
    if (title) title.textContent = "选择讲师照片";
    if (!state.photoFiles.length) {
      els.photosMeta.textContent = "支持多选，按人物或讲师姓名字段匹配";
    }
    return;
  }
  if (currentWorkflow() === "avatar3d") {
    if (step) step.textContent = "2";
    if (heading) heading.textContent = "人物头像";
    if (kicker) kicker.textContent = "头像";
    if (title) title.textContent = "选择人物头像";
    if (!state.photoFiles.length) {
      els.photosMeta.textContent = "支持单张或多张头像，生成后统一为 3:4 白底";
    }
    return;
  }
  if (currentWorkflow() === "matting") {
    if (step) step.textContent = "2";
    if (heading) heading.textContent = "待处理照片";
    if (kicker) kicker.textContent = "照片";
    if (title) title.textContent = "选择待抠图照片";
    if (!state.photoFiles.length) {
      els.photosMeta.textContent = "支持多选，建议使用纯色或近似纯色背景人物照片";
    }
    return;
  }
  if (step) step.textContent = "3";
  if (heading) heading.textContent = "人员照片";
  if (kicker) kicker.textContent = "素材";
  if (title) title.textContent = "选择人员照片";
  if (!state.photoFiles.length) {
    els.photosMeta.textContent = "支持多选，按人物或姓名字段匹配";
  }
}

function renderPeopleStrip() {
  els.peopleStrip.innerHTML = "";

  if (currentWorkflow() === "avatar3d") {
    state.photoRecords.slice(0, 200).forEach((record, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `people-card${index === state.activeIndex ? " active" : ""}`;
      button.innerHTML = `
        <span>
          <span class="person-name">${escapeHtml(record.file.name.replace(/\.[^.]+$/, ""))}</span>
          <span class="person-title">${record.avatar3dImage ? "已生成3D头像" : "待生成"}</span>
        </span>
      `;
      button.addEventListener("click", () => {
        state.activeIndex = index;
        state.showAvatarOriginal = false;
        drawPoster();
        renderPeopleStrip();
      });
      els.peopleStrip.appendChild(button);
    });
    return;
  }

  if (currentWorkflow() === "matting") {
    state.photoRecords.slice(0, 200).forEach((record, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `people-card${index === state.activeIndex ? " active" : ""}`;
      button.innerHTML = `
        <span>
          <span class="person-name">${escapeHtml(record.file.name.replace(/\.[^.]+$/, ""))}</span>
          <span class="person-title">${record.mattedImage ? "已生成透明图" : "待抠图"}</span>
        </span>
      `;
      button.addEventListener("click", () => {
        state.activeIndex = index;
        drawPoster();
        renderPeopleStrip();
      });
      els.peopleStrip.appendChild(button);
    });
    return;
  }

  state.rows.slice(0, 200).forEach((row, index) => {
    const primaryName = displayNameForRow(row, index);
    const secondaryText = state.builtInTemplate.id === "lecturer-poster"
      ? fixedValue(row, "course") || fixedValue(row, "thanks") || "未设置课程"
      : fixedValue(row, "region") || fixedValue(row, "content") || "未设置所属大区";
    const button = document.createElement("button");
    button.type = "button";
    button.className = `people-card${index === state.activeIndex ? " active" : ""}`;
    button.innerHTML = `
      <span>
        <span class="person-name">${escapeHtml(primaryName)}</span>
        <span class="person-title">${escapeHtml(secondaryText)}</span>
      </span>
    `;
    button.addEventListener("click", () => {
      state.activeIndex = index;
      clearNativePreview();
      drawPoster();
      renderPeopleStrip();
    });
    els.peopleStrip.appendChild(button);
  });
}

function updateChrome() {
  const isMattingWorkflow = currentWorkflow() === "matting";
  const isAvatar3dWorkflow = currentWorkflow() === "avatar3d";
  const total = isMattingWorkflow || isAvatar3dWorkflow ? state.photoRecords.length : state.rows.length;
  const hasTemplate = !state.builtInTemplate.comingSoon;
  els.personCounter.textContent = total ? `${state.activeIndex + 1} / ${total}` : "0 / 0";
  els.prevPerson.disabled = isMattingWorkflow || isAvatar3dWorkflow || !hasTemplate || !total || state.activeIndex <= 0;
  els.nextPerson.disabled = isMattingWorkflow || isAvatar3dWorkflow || !hasTemplate || !total || state.activeIndex >= total - 1;
  els.downloadPreview.disabled = isMattingWorkflow || isAvatar3dWorkflow || !hasTemplate || !total;
  els.batchProcess.disabled = isMattingWorkflow || isAvatar3dWorkflow || state.isBatching || !total || !hasTemplate;
  els.batchProcess.textContent = state.isBatching ? "正在批量导出..." : "批量导出所有图片";
  if (els.removeWhiteBg) {
    els.removeWhiteBg.disabled = !isMattingWorkflow || state.isMatting || !hasTemplate || !state.photoRecords.length;
    els.removeWhiteBg.textContent = state.isMatting ? "正在抠图..." : "智能背景抠图";
  }
  if (els.mattingOriginal) {
    els.mattingOriginal.disabled = !isMattingWorkflow || state.isMatting || !hasTemplate || !state.photoRecords.length || !state.useMattedPhotos;
  }
  if (els.downloadMattedPhotos) {
    els.downloadMattedPhotos.disabled = !isMattingWorkflow || state.isMatting || !state.mattedPhotoFiles.length;
  }
  if (els.downloadMattedPreview) {
    const record = state.photoRecords[state.activeIndex];
    els.downloadMattedPreview.disabled = !isMattingWorkflow || state.isMatting || !record?.mattedBlob;
  }
  if (els.mattingPrev) {
    els.mattingPrev.disabled = !isMattingWorkflow || state.isMatting || !total || state.activeIndex <= 0;
  }
  if (els.mattingNext) {
    els.mattingNext.disabled = !isMattingWorkflow || state.isMatting || !total || state.activeIndex >= total - 1;
  }
  const activeAvatarRecord = state.photoRecords[state.activeIndex];
  if (els.generateAvatar3d) {
    els.generateAvatar3d.disabled = !isAvatar3dWorkflow || state.isGeneratingAvatar3d || !hasTemplate || !state.photoRecords.length;
    els.generateAvatar3d.textContent = state.isGeneratingAvatar3d ? "正在生成..." : "生成3D头像";
  }
  if (els.avatarOriginal) {
    els.avatarOriginal.disabled = !isAvatar3dWorkflow || state.isGeneratingAvatar3d || !hasTemplate || !activeAvatarRecord;
    els.avatarOriginal.textContent = state.showAvatarOriginal ? "查看生成图" : "查看原图";
  }
  if (els.avatarPrev) {
    els.avatarPrev.disabled = !isAvatar3dWorkflow || state.isGeneratingAvatar3d || !total || state.activeIndex <= 0;
  }
  if (els.avatarNext) {
    els.avatarNext.disabled = !isAvatar3dWorkflow || state.isGeneratingAvatar3d || !total || state.activeIndex >= total - 1;
  }
  if (els.downloadAvatarPreview) {
    els.downloadAvatarPreview.disabled = !isAvatar3dWorkflow || state.isGeneratingAvatar3d || !activeAvatarRecord?.avatar3dBlob;
  }
  if (els.downloadAvatarBatch) {
    els.downloadAvatarBatch.disabled = !isAvatar3dWorkflow || state.isGeneratingAvatar3d || !state.avatar3dFiles.length;
  }
  if (state.isBatching) {
    els.workflowStatus.textContent = "批量处理中";
  } else if (state.isMatting) {
    els.workflowStatus.textContent = "抠图处理中";
  } else if (state.isGeneratingAvatar3d) {
    els.workflowStatus.textContent = "生成处理中";
  } else if (state.builtInTemplate.comingSoon) {
    els.workflowStatus.textContent = "建设中";
  } else if (isAvatar3dWorkflow) {
    els.workflowStatus.textContent = total
      ? state.avatar3dFiles.length
        ? "3D头像已生成"
        : "头像已就绪"
      : "等待头像";
  } else if (isMattingWorkflow) {
    els.workflowStatus.textContent = total
      ? state.useMattedPhotos
        ? "透明图已就绪"
        : "照片已就绪"
      : "等待照片";
  } else {
    els.workflowStatus.textContent = total ? "可预览" : "内置模板已就绪";
  }

  const row = state.rows[state.activeIndex];
  const photoRecord = state.photoRecords[state.activeIndex];
  const name = row ? displayNameForRow(row, state.activeIndex) : "";
  if (state.builtInTemplate.comingSoon) {
    els.previewTitle.textContent = `${state.builtInTemplate.name} - 正在建设中`;
  } else if (isAvatar3dWorkflow) {
    els.previewTitle.textContent = photoRecord
      ? `${photoRecord.file.name.replace(/\.[^.]+$/, "")} - 3D头像预览`
      : "3D人物转换预览";
  } else if (isMattingWorkflow) {
    els.previewTitle.textContent = photoRecord
      ? `${photoRecord.file.name.replace(/\.[^.]+$/, "")} - 抠图预览`
      : "人像抠图预览";
  } else {
    els.previewTitle.textContent = name ? `${name} - 输出图片预览` : "输出图片预览";
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function handleTemplateFile(file) {
  if (!file) return;
  const lowerName = file.name.toLowerCase();
  clearNativePreview();
  state.templateFile = file;
  state.templateImage = null;
  state.sketchTemplate = null;
  state.templateFileName = file.name;
  els.templateMeta.textContent = `${file.name} · ${formatBytes(file.size)}`;

  if (lowerName.endsWith(".sketch")) {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const template = await parseSketchTemplate(reader.result);
        state.sketchTemplate = template;
        setCanvasSize(template.width, template.height);
        const renderMode = template.previewImage ? "完整预览底图" : "基础图层渲染";
        els.templateMeta.textContent = `${file.name} · ${template.width} × ${template.height} · ${renderMode} · 图层 ${formatSketchTargets(template.targets)}`;
        drawPoster();
      } catch (error) {
        els.templateMeta.textContent = error.message || "源文件解析失败";
        setCanvasSize(1080, 1440);
        drawPoster();
      }
    };
    reader.readAsArrayBuffer(file);
    return;
  }

  if (!file.type.startsWith("image/")) {
    els.templateMeta.textContent = `${file.name} 已接收，预览需使用图片文件`;
    setCanvasSize(1080, 1440);
    drawPoster();
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = () => {
      state.templateImage = image;
      setCanvasSize(1080, 1440);
      drawPoster();
    };
    image.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function handleDataFile(file) {
  if (!file) return;
  clearNativePreview();
  state.dataFile = file;
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith(".xls") && !lowerName.endsWith(".xlsx")) {
    els.dataMeta.textContent = `${file.name} 暂不支持，请另存为新版表格文件`;
    return;
  }

  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const table = lowerName.endsWith(".xlsx")
        ? await parseXlsx(reader.result)
        : parseCsv(String(reader.result || ""));
      const parsed = tableToObjects(table);
      state.headers = parsed.headers;
      state.rows = parsed.rows;
      state.activeIndex = 0;
      const missing = missingExcelFields();
      els.dataMeta.textContent = missing.length
        ? `${file.name} · ${state.rows.length} 条记录 · 缺少字段：${fieldLabelText(missing)}`
        : `${file.name} · ${state.rows.length} 条记录 · 当前模板字段已匹配`;
      renderPeopleStrip();
      drawPoster();
    } catch (error) {
      els.dataMeta.textContent = error.message || "表格解析失败";
    }
  };

  if (lowerName.endsWith(".xlsx")) {
    reader.readAsArrayBuffer(file);
  } else {
    reader.readAsText(file, "utf-8");
  }
}

function handlePhotoFiles(files) {
  const fileList = Array.from(files || []).filter((file) => file.type.startsWith("image/"));
  if (!fileList.length) return;
  clearNativePreview();
  state.photoFiles = fileList;
  state.photoRecords = [];
  state.mattedPhotoFiles = [];
  state.avatar3dFiles = [];
  state.useMattedPhotos = false;
  state.showAvatarOriginal = false;
  state.photos.clear();
  state.originalPhotos.clear();
  state.activeIndex = 0;
  if (els.mattingNotice) {
    els.mattingNotice.textContent = "照片已加载，点击智能背景抠图后会自动识别人像。";
  }
  if (els.avatar3dNotice) {
    els.avatar3dNotice.textContent = "头像已加载，选择风格后点击生成。";
  }

  let loaded = 0;
  fileList.forEach((file) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        image.__subjectBounds = detectSubjectBounds(image);
        state.photoRecords.push({
          file,
          originalImage: image,
          mattedImage: null,
          mattedBlob: null,
        });
        const keys = photoKeysForFile(file.name);
        keys.forEach((key) => state.photos.set(key, image));
        keys.forEach((key) => state.originalPhotos.set(key, image));
        loaded += 1;
        els.photosMeta.textContent = `已加载 ${loaded} / ${fileList.length} 张照片`;
        if (loaded === fileList.length) {
          els.photosMeta.textContent = `已加载 ${fileList.length} 张照片`;
          updateChrome();
          drawPoster();
        }
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function removeWhiteBackgroundFromPhotos() {
  if (!state.photoRecords.length || state.isMatting) return;

  state.isMatting = true;
  state.mattedPhotoFiles = [];
  updateChrome();

  const tolerance = Number(els.mattingTolerance?.value || 72);
  const feather = Number(els.mattingFeather?.value || 28);

  try {
    for (let index = 0; index < state.photoRecords.length; index += 1) {
      const record = state.photoRecords[index];
      if (els.mattingNotice) {
        els.mattingNotice.textContent = `正在智能抠图 ${index + 1} / ${state.photoRecords.length}`;
      }
      const result = await createTransparentPortrait(record.originalImage, tolerance, feather);
      const image = await imageFromBlob(result.blob);
      image.__subjectBounds = detectSubjectBounds(image);
      record.mattingEngine = result.engine;
      record.mattedImage = image;
      record.mattedBlob = result.blob;
      state.mattedPhotoFiles.push({
        name: transparentPhotoName(record.file.name),
        blob: result.blob,
      });
      await waitFrame();
    }

    state.useMattedPhotos = true;
    rebuildPhotoMap();
    if (els.mattingNotice) {
      const usedAi = state.photoRecords.some((record) => record.mattingEngine === "ai");
      els.mattingNotice.textContent = usedAi
        ? `已完成 ${state.mattedPhotoFiles.length} 张智能透明 PNG。`
        : `已完成 ${state.mattedPhotoFiles.length} 张透明 PNG，当前使用纯色背景算法。`;
    }
    drawPoster();
    renderPeopleStrip();
  } catch (error) {
    if (els.mattingNotice) {
      els.mattingNotice.textContent = error.message || "抠图失败，请换一张白底照片后重试。";
    }
  } finally {
    state.isMatting = false;
    updateChrome();
  }
}

function useOriginalPhotos() {
  state.useMattedPhotos = false;
  rebuildPhotoMap();
  if (els.mattingNotice) {
    els.mattingNotice.textContent = state.mattedPhotoFiles.length
      ? "已切回原图，透明 PNG 仍可单独导出。"
      : "当前使用原图。";
  }
  drawPoster();
  renderPeopleStrip();
  updateChrome();
}

function styleLabel() {
  const value = els.avatarStyle?.value || "pixar";
  if (value === "business") return "商务3D风格";
  if (value === "tech") return "科技数字人风格";
  return "皮克斯风格";
}

async function generateAvatar3dPortraits() {
  if (!state.photoRecords.length || state.isGeneratingAvatar3d) return;

  state.isGeneratingAvatar3d = true;
  state.showAvatarOriginal = false;
  state.avatar3dFiles = [];
  updateChrome();

  try {
    for (let index = 0; index < state.photoRecords.length; index += 1) {
      const record = state.photoRecords[index];
      state.activeIndex = index;
      if (els.avatar3dNotice) {
        els.avatar3dNotice.textContent = `正在生成 ${index + 1} / ${state.photoRecords.length}：${record.file.name}`;
      }
      const blob = await createAvatar3dBlob(record, els.avatarStyle?.value || "pixar");
      const image = await imageFromBlob(blob);
      record.avatar3dImage = image;
      record.avatar3dBlob = blob;
      record.avatar3dStyle = els.avatarStyle?.value || "pixar";
      state.avatar3dFiles.push({
        name: avatar3dFileName(record.file.name),
        blob,
      });
      drawPoster();
      renderPeopleStrip();
      await waitFrame();
    }

    if (els.avatar3dNotice) {
      els.avatar3dNotice.textContent = `已生成 ${state.avatar3dFiles.length} 张 3:4 白底 ${styleLabel()}头像。`;
    }
  } catch (error) {
    if (els.avatar3dNotice) {
      els.avatar3dNotice.textContent = error.message || "3D头像生成失败，请更换头像后重试。";
    }
  } finally {
    state.isGeneratingAvatar3d = false;
    updateChrome();
  }
}

async function createAvatar3dBlob(record, style) {
  try {
    const aiBlob = await requestAiAvatar3dBlob(record.file, style);
    const aiImage = await imageFromBlob(aiBlob);
    return normalizeAvatar3dBlob(aiImage, style);
  } catch {
    return createLocalAvatar3dBlob(record.originalImage, style);
  }
}

async function requestAiAvatar3dBlob(file, style) {
  const formData = new FormData();
  formData.append("image", file);
  formData.append("style", style);
  const response = await fetch(apiUrl("/api/avatar-3d"), {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.blob();
}

function normalizeAvatar3dBlob(image, style) {
  return new Promise((resolve, reject) => {
    const output = document.createElement("canvas");
    output.width = 900;
    output.height = 1200;
    const out = output.getContext("2d");
    if (!out) {
      reject(new Error("头像无法处理"));
      return;
    }
    out.fillStyle = "#ffffff";
    out.fillRect(0, 0, output.width, output.height);
    drawAvatarStudioBackground(out, output.width, output.height, style);
    drawCoverImageWithContext(out, image, 0, 0, output.width, output.height);
    drawAvatar3dFrame(out, output.width, output.height, style);
    output.toBlob((blob) => {
      if (!blob) {
        reject(new Error("头像生成失败"));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

function createLocalAvatar3dBlob(image, style) {
  return new Promise((resolve, reject) => {
    const output = document.createElement("canvas");
    output.width = 900;
    output.height = 1200;
    const out = output.getContext("2d");
    if (!out) {
      reject(new Error("头像无法处理"));
      return;
    }

    out.fillStyle = "#ffffff";
    out.fillRect(0, 0, output.width, output.height);
    drawAvatarStudioBackground(out, output.width, output.height, style);

    const photoBox = { x: 92, y: 96, width: 716, height: 930 };
    out.save();
    out.shadowColor = "rgba(16, 24, 40, 0.16)";
    out.shadowBlur = 46;
    out.shadowOffsetY = 26;
    roundRect(out, photoBox.x, photoBox.y, photoBox.width, photoBox.height, 42);
    out.fillStyle = "#ffffff";
    out.fill();
    out.clip();
    out.filter = avatar3dFilter(style);
    drawCoverImageWithContext(out, image, photoBox.x, photoBox.y, photoBox.width, photoBox.height);
    out.filter = "none";
    drawAvatar3dLighting(out, photoBox, style);
    out.restore();

    drawAvatar3dFrame(out, output.width, output.height, style);
    output.toBlob((blob) => {
      if (!blob) {
        reject(new Error("3D头像生成失败"));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

function drawAvatarStudioBackground(context, width, height, style) {
  const topGlow = context.createRadialGradient(width * 0.5, height * 0.08, 20, width * 0.5, height * 0.08, 520);
  topGlow.addColorStop(0, style === "tech" ? "rgba(220, 244, 255, 0.9)" : "rgba(250, 245, 239, 0.95)");
  topGlow.addColorStop(1, "rgba(255, 255, 255, 0)");
  context.fillStyle = topGlow;
  context.fillRect(0, 0, width, height);

  const bottomGlow = context.createRadialGradient(width * 0.5, height * 0.86, 40, width * 0.5, height * 0.86, 360);
  bottomGlow.addColorStop(0, style === "business" ? "rgba(210, 224, 245, 0.72)" : "rgba(232, 225, 255, 0.72)");
  bottomGlow.addColorStop(1, "rgba(255, 255, 255, 0)");
  context.fillStyle = bottomGlow;
  context.fillRect(0, 0, width, height);
}

function avatar3dFilter(style) {
  if (style === "business") return "brightness(1.04) contrast(1.06) saturate(1.08)";
  if (style === "tech") return "brightness(1.08) contrast(1.14) saturate(1.2)";
  return "brightness(1.08) contrast(1.1) saturate(1.22)";
}

function drawAvatar3dLighting(context, box, style) {
  const highlight = context.createRadialGradient(box.x + box.width * 0.34, box.y + box.height * 0.22, 12, box.x + box.width * 0.34, box.y + box.height * 0.22, 360);
  highlight.addColorStop(0, style === "tech" ? "rgba(178, 229, 255, 0.26)" : "rgba(255, 238, 216, 0.3)");
  highlight.addColorStop(1, "rgba(255, 255, 255, 0)");
  context.fillStyle = highlight;
  context.fillRect(box.x, box.y, box.width, box.height);

  const shade = context.createLinearGradient(box.x, box.y, box.x + box.width, box.y + box.height);
  shade.addColorStop(0, "rgba(255, 255, 255, 0.12)");
  shade.addColorStop(0.45, "rgba(255, 255, 255, 0)");
  shade.addColorStop(1, "rgba(22, 28, 42, 0.14)");
  context.fillStyle = shade;
  context.fillRect(box.x, box.y, box.width, box.height);
}

function drawAvatar3dFrame(context, width, height, style) {
  const accent = style === "tech" ? "#28c7ff" : style === "business" ? "#667085" : "#8f73ff";
  context.strokeStyle = "rgba(16, 24, 40, 0.08)";
  context.lineWidth = 2;
  roundRect(context, 52, 52, width - 104, height - 104, 42);
  context.stroke();
  context.fillStyle = accent;
  roundRect(context, width / 2 - 42, height - 92, 84, 8, 4);
  context.fill();
}

function drawCoverImageWithContext(context, image, x, y, width, height) {
  const scale = Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const dx = x + (width - drawWidth) / 2;
  const dy = y + (height - drawHeight) / 2;
  context.drawImage(image, dx, dy, drawWidth, drawHeight);
}

function avatar3dFileName(filename) {
  const base = String(filename || "人物头像").replace(/\.[^.]+$/, "");
  return sanitizeFileName(`${base}-${styleLabel()}.png`);
}

async function downloadAvatar3dBatch() {
  if (!state.avatar3dFiles.length) return;
  const zipBlob = await createZip(state.avatar3dFiles);
  downloadBlob(zipBlob, "3D人物头像.zip");
}

function downloadCurrentAvatar3d() {
  const record = state.photoRecords[state.activeIndex];
  if (!record?.avatar3dBlob) return;
  downloadBlob(record.avatar3dBlob, avatar3dFileName(record.file.name));
}

function toggleAvatarOriginal() {
  const record = state.photoRecords[state.activeIndex];
  if (!record) return;
  state.showAvatarOriginal = !state.showAvatarOriginal;
  drawPoster();
  updateChrome();
}

function rebuildPhotoMap() {
  state.photos.clear();
  state.photoRecords.forEach((record) => {
    const image = currentWorkflow() === "matting" && state.useMattedPhotos && record.mattedImage
      ? record.mattedImage
      : record.originalImage;
    const keys = photoKeysForFile(record.file.name);
    keys.forEach((key) => state.photos.set(key, image));
  });
}

async function downloadMattedPhotos() {
  if (!state.mattedPhotoFiles.length) return;
  const zipBlob = await createZip(state.mattedPhotoFiles);
  downloadBlob(zipBlob, "透明人物照片.zip");
}

function downloadCurrentMattedPhoto() {
  const record = state.photoRecords[state.activeIndex];
  if (!record?.mattedBlob) return;
  downloadBlob(record.mattedBlob, transparentPhotoName(record.file.name));
}

function transparentPhotoName(filename) {
  const base = String(filename || "人物照片").replace(/\.[^.]+$/, "");
  return sanitizeFileName(`${base}-透明.png`);
}

function imageFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("透明图片读取失败"));
    };
    image.src = url;
  });
}

async function createTransparentPortrait(image, tolerance, feather) {
  try {
    return await createTransparentPortraitWithAi(image, feather);
  } catch (error) {
    return createTransparentPortraitWithColorKey(image, tolerance, feather);
  }
}

async function createTransparentPortraitWithAi(image, feather) {
  const segmentation = await getSelfieSegmentation();
  const results = await runSelfieSegmentation(segmentation, image);
  if (!results?.segmentationMask) {
    throw new Error("智能抠图模型未返回有效结果");
  }

  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const sourceCanvas = document.createElement("canvas");
  const maskCanvas = document.createElement("canvas");
  const outputCanvas = document.createElement("canvas");
  sourceCanvas.width = maskCanvas.width = outputCanvas.width = width;
  sourceCanvas.height = maskCanvas.height = outputCanvas.height = height;
  const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
  const maskContext = maskCanvas.getContext("2d", { willReadFrequently: true });
  const outputContext = outputCanvas.getContext("2d");
  if (!sourceContext || !maskContext || !outputContext || !width || !height) {
    throw new Error("照片无法处理");
  }

  sourceContext.drawImage(image, 0, 0, width, height);
  maskContext.filter = feather ? `blur(${Math.max(0, feather * 0.35)}px)` : "none";
  maskContext.drawImage(results.segmentationMask, 0, 0, width, height);
  maskContext.filter = "none";

  const sourceData = sourceContext.getImageData(0, 0, width, height);
  const maskData = maskContext.getImageData(0, 0, width, height);
  const pixels = sourceData.data;
  const maskPixels = maskData.data;

  for (let index = 0; index < pixels.length; index += 4) {
    const maskValue = Math.max(maskPixels[index], maskPixels[index + 1], maskPixels[index + 2]) * (maskPixels[index + 3] / 255);
    const alphaRatio = smoothMaskAlpha(maskValue);
    pixels[index + 3] = Math.round(pixels[index + 3] * alphaRatio);
  }

  sourceContext.putImageData(sourceData, 0, 0);
  outputContext.clearRect(0, 0, width, height);
  outputContext.drawImage(sourceCanvas, 0, 0);

  return new Promise((resolve, reject) => {
    outputCanvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("透明 PNG 生成失败"));
        return;
      }
      resolve({ blob, engine: "ai" });
    }, "image/png");
  });
}

function smoothMaskAlpha(value) {
  const low = 18;
  const high = 188;
  const ratio = Math.min(1, Math.max(0, (value - low) / (high - low)));
  return ratio * ratio * (3 - 2 * ratio);
}

async function getSelfieSegmentation() {
  if (selfieSegmentationInstance) return selfieSegmentationInstance;
  await loadExternalScript(SELFIE_SEGMENTATION_URL);
  if (!window.SelfieSegmentation) {
    throw new Error("智能抠图模型加载失败");
  }
  selfieSegmentationInstance = new window.SelfieSegmentation({
    locateFile: (file) => `${SELFIE_SEGMENTATION_BASE}${file}`,
  });
  selfieSegmentationInstance.setOptions({
    modelSelection: 0,
    selfieMode: false,
  });
  return selfieSegmentationInstance;
}

function loadExternalScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (window.SelfieSegmentation) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("智能抠图模型加载失败")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("智能抠图模型加载失败"));
    document.head.appendChild(script);
  });
}

function runSelfieSegmentation(segmentation, image) {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("智能抠图模型处理超时")), 20000);
    segmentation.onResults((results) => {
      window.clearTimeout(timer);
      resolve(results);
    });
    segmentation.send({ image }).catch((error) => {
      window.clearTimeout(timer);
      reject(error);
    });
  });
}

function createTransparentPortraitWithColorKey(image, tolerance, feather) {
  return new Promise((resolve, reject) => {
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    const workCanvas = document.createElement("canvas");
    workCanvas.width = width;
    workCanvas.height = height;
    const workContext = workCanvas.getContext("2d", { willReadFrequently: true });
    if (!workContext || !width || !height) {
      reject(new Error("照片无法处理"));
      return;
    }

    workContext.clearRect(0, 0, width, height);
    workContext.drawImage(image, 0, 0, width, height);
    const imageData = workContext.getImageData(0, 0, width, height);
    removeConnectedLightBackground(imageData, width, height, tolerance, feather);
    workContext.putImageData(imageData, 0, 0);
    workCanvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("透明 PNG 生成失败"));
        return;
      }
      resolve({ blob, engine: "color" });
    }, "image/png");
  });
}

function removeConnectedLightBackground(imageData, width, height, tolerance, feather) {
  const data = imageData.data;
  const total = width * height;
  const visited = new Uint8Array(total);
  const queue = [];
  const backgroundModel = estimateBackgroundModel(data, width, height);
  const searchLimit = Math.max(8, tolerance + feather * 0.5);

  const enqueue = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const index = y * width + x;
    if (visited[index]) return;
    const pixelIndex = index * 4;
    const match = backgroundMatch(
      data[pixelIndex],
      data[pixelIndex + 1],
      data[pixelIndex + 2],
      backgroundModel,
      searchLimit,
    );
    if (
      data[pixelIndex + 3] <= 6 ||
      (match &&
        !isProtectedSubjectPixel(x, y, data[pixelIndex], data[pixelIndex + 1], data[pixelIndex + 2], width, height, backgroundModel, match))
    ) {
      visited[index] = 1;
      queue.push(index);
    }
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const index = queue[cursor];
    const x = index % width;
    const y = Math.floor(index / width);
    enqueue(x + 1, y);
    enqueue(x - 1, y);
    enqueue(x, y + 1);
    enqueue(x, y - 1);
  }

  const softRange = Math.max(1, feather);
  for (let index = 0; index < total; index += 1) {
    const pixelIndex = index * 4;
    const x = index % width;
    const y = Math.floor(index / width);
    const match = backgroundMatch(
      data[pixelIndex],
      data[pixelIndex + 1],
      data[pixelIndex + 2],
      backgroundModel,
      searchLimit,
    );
    if (!match) continue;

    const protectedPixel = isProtectedSubjectPixel(
      x,
      y,
      data[pixelIndex],
      data[pixelIndex + 1],
      data[pixelIndex + 2],
      width,
      height,
      backgroundModel,
      match,
    );
    const backgroundResidue = !visited[index] && match.distance <= match.tolerance * 0.72 && !protectedPixel;
    if (!visited[index] && !backgroundResidue) continue;

    if (match.distance <= match.tolerance) {
      data[pixelIndex + 3] = 0;
      continue;
    }
    const alphaRatio = Math.min(1, Math.max(0, (match.distance - match.tolerance) / softRange));
    data[pixelIndex + 3] = Math.round(data[pixelIndex + 3] * alphaRatio);
  }
}

function estimateBackgroundModel(data, width, height) {
  const buckets = new Map();
  const step = Math.max(1, Math.floor(Math.min(width, height) / 80));
  const insets = [0, Math.max(1, Math.floor(Math.min(width, height) * 0.018))];
  const addSample = (x, y) => {
    const pixelIndex = (y * width + x) * 4;
    const alpha = data[pixelIndex + 3];
    if (alpha <= 6) return;
    const r = data[pixelIndex];
    const g = data[pixelIndex + 1];
    const b = data[pixelIndex + 2];
    const key = `${Math.round(r / 18)},${Math.round(g / 18)},${Math.round(b / 18)}`;
    const bucket = buckets.get(key) || { count: 0, r: 0, g: 0, b: 0 };
    bucket.count += 1;
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    buckets.set(key, bucket);
  };

  insets.forEach((inset) => {
    const left = Math.min(inset, width - 1);
    const right = Math.max(0, width - 1 - inset);
    const top = Math.min(inset, height - 1);
    const bottom = Math.max(0, height - 1 - inset);
    for (let x = left; x <= right; x += step) {
      addSample(x, top);
      addSample(x, bottom);
    }
    for (let y = top; y <= bottom; y += step) {
      addSample(left, y);
      addSample(right, y);
    }
  });

  const sorted = Array.from(buckets.values()).sort((a, b) => b.count - a.count);
  const dominant = sorted[0];
  if (!dominant) {
    return {
      colors: [{ r: 255, g: 255, b: 255, tolerance: 72 }],
      brightness: 255,
    };
  }

  const colors = sorted
    .filter((bucket, index) => index < 7 || bucket.count >= dominant.count * 0.18)
    .slice(0, 8)
    .map((bucket) => {
      const color = {
        r: bucket.r / bucket.count,
        g: bucket.g / bucket.count,
        b: bucket.b / bucket.count,
      };
      return {
        ...color,
        tolerance: adaptiveBackgroundTolerance(72, color),
      };
    });
  const brightness = (colors[0].r + colors[0].g + colors[0].b) / 3;
  return { colors, brightness };
}

function backgroundMatch(r, g, b, backgroundModel, requestedTolerance) {
  let best = null;
  backgroundModel.colors.forEach((color) => {
    const tolerance = Math.min(requestedTolerance, adaptiveBackgroundTolerance(requestedTolerance, color));
    const distance = backgroundDistance(r, g, b, color);
    const lightNeutral = isVeryLightNeutralBackground(r, g, b, color, tolerance);
    if (distance <= tolerance || lightNeutral) {
      if (!best || distance < best.distance) {
        best = { distance, tolerance, color };
      }
    }
  });
  return best;
}

function isVeryLightNeutralBackground(r, g, b, background, tolerance) {
  const backgroundBrightness = (background.r + background.g + background.b) / 3;
  if (backgroundBrightness < 180) return false;
  const brightness = (r + g + b) / 3;
  const chroma = Math.max(r, g, b) - Math.min(r, g, b);
  return brightness >= Math.max(176, 255 - tolerance * 0.86) && chroma <= Math.max(18, tolerance * 0.42);
}

function adaptiveBackgroundTolerance(tolerance, background) {
  const brightness = (background.r + background.g + background.b) / 3;
  if (brightness < 80) return Math.max(8, tolerance * 0.22);
  if (brightness < 130) return Math.max(14, tolerance * 0.34);
  if (brightness < 190) return Math.max(22, tolerance * 0.52);
  return tolerance;
}

function isProtectedSubjectPixel(x, y, r, g, b, width, height, backgroundModel, match) {
  const nx = x / width;
  const ny = y / height;
  const centerDistance = Math.abs(nx - 0.5);
  const inHeadAndBody = centerDistance < 0.34 && ny > 0.08 && ny < 0.98;
  const inBodyCore = centerDistance < 0.28 && ny > 0.22 && ny < 0.98;
  if (!inHeadAndBody) return false;

  const brightness = (r + g + b) / 3;
  const chroma = Math.max(r, g, b) - Math.min(r, g, b);
  const backgroundBrightness = backgroundModel.brightness;
  const closeToBackground = match.distance <= Math.max(6, match.tolerance * 0.36);

  if (backgroundBrightness < 145 && inBodyCore && brightness < 155) {
    return !closeToBackground || chroma > 10;
  }
  if (backgroundBrightness >= 145 && inBodyCore && brightness < 245) {
    return !closeToBackground;
  }
  return false;
}

function backgroundDistance(r, g, b, background) {
  const dr = background.r - r;
  const dg = background.g - g;
  const db = background.b - b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function photoKeysForFile(filename) {
  const withoutExt = normalizeKey(filename.replace(/\.[^.]+$/, ""));
  return new Set([normalizeKey(filename), withoutExt]);
}

function findPersonPhoto(row) {
  const candidates = [
    fixedValue(row, "photo"),
    row.photo,
    fixedValue(row, "teacherName"),
    row.teacherName,
    fixedValue(row, "name"),
    row.name,
  ].filter(Boolean);

  for (const candidate of candidates) {
    const normalized = normalizeKey(candidate);
    const withoutExt = normalizeKey(String(candidate).replace(/\.[^.]+$/, ""));
    if (state.photos.has(normalized)) return state.photos.get(normalized);
    if (state.photos.has(withoutExt)) return state.photos.get(withoutExt);
  }
  return null;
}

function detectSubjectBounds(image) {
  const probe = document.createElement("canvas");
  probe.width = image.naturalWidth || image.width;
  probe.height = image.naturalHeight || image.height;
  const probeContext = probe.getContext("2d", { willReadFrequently: true });
  if (!probeContext || !probe.width || !probe.height) return null;

  probeContext.clearRect(0, 0, probe.width, probe.height);
  probeContext.drawImage(image, 0, 0, probe.width, probe.height);

  let minX = probe.width;
  let minY = probe.height;
  let maxX = -1;
  let maxY = -1;
  let visiblePixels = 0;
  const pixels = probeContext.getImageData(0, 0, probe.width, probe.height).data;

  for (let y = 0; y < probe.height; y += 1) {
    for (let x = 0; x < probe.width; x += 1) {
      const alpha = pixels[(y * probe.width + x) * 4 + 3];
      if (alpha <= 12) continue;
      visiblePixels += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (!visiblePixels) return null;
  const coverage = visiblePixels / (probe.width * probe.height);
  if (coverage > 0.96) return null;
  return { left: minX, top: minY, right: maxX, bottom: maxY };
}

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .replace(/^.*[\\/]/, "")
    .replace(/\.[^.]+$/, "")
    .toLowerCase();
}

async function loadBuiltInAssets() {
  const requestId = state.builtInAssetRequest + 1;
  state.builtInAssetRequest = requestId;
  const template = state.builtInTemplate;
  const assets = template.assets || {};
  state.builtInAssets = { background: null, overlay: null };

  try {
    const [background, overlay] = await Promise.all([
      assets.background ? loadImageFromUrl(resolveTemplateAssetSource(template.id, "background", assets.background)) : Promise.resolve(null),
      assets.overlay ? loadImageFromUrl(resolveTemplateAssetSource(template.id, "overlay", assets.overlay)) : Promise.resolve(null),
    ]);
    if (requestId !== state.builtInAssetRequest) return;
    state.builtInAssets.background = background;
    state.builtInAssets.overlay = overlay;
    updateTemplateDetail();
    drawPoster();
  } catch (error) {
    if (requestId !== state.builtInAssetRequest) return;
    if (els.templateMeta) {
      els.templateMeta.textContent = `${template.name} 素材加载失败：${error.message || ""}`;
    }
  }
}

function resolveTemplateAssetSource(templateId, assetType, fallback) {
  return window.HAIBAO_TEMPLATE_ASSETS?.[templateId]?.[assetType] || fallback;
}

function loadImageFromUrl(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (/^https?:\/\//.test(src)) {
      image.crossOrigin = "anonymous";
    }
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`无法加载图片：${src}`));
    image.src = src;
  });
}

function apiUrl(path) {
  if (window.location.protocol === "file:") {
    return `http://127.0.0.1:8108${path}`;
  }
  return path;
}

function clearNativePreview() {
  state.nativePreview = null;
  state.nativePreviewError = "";
  state.nativePreviewRequest += 1;
  if (state.nativePreviewTimer) {
    clearTimeout(state.nativePreviewTimer);
    state.nativePreviewTimer = null;
  }
}

function canUseNativeSketchPreview() {
  return Boolean(
    state.sketchTemplate &&
      state.templateFile &&
      state.templateFile.name.toLowerCase().endsWith(".sketch") &&
      state.dataFile &&
      state.rows.length,
  );
}

function scheduleNativePreview() {
  if (!canUseNativeSketchPreview()) return;
  if (state.nativePreview?.index === state.activeIndex && state.nativePreview.image) return;

  if (state.nativePreviewTimer) clearTimeout(state.nativePreviewTimer);
  const requestId = state.nativePreviewRequest + 1;
  state.nativePreviewRequest = requestId;
  state.nativePreviewTimer = setTimeout(() => {
    state.nativePreviewTimer = null;
    loadNativePreview(requestId, state.activeIndex);
  }, 240);
}

async function loadNativePreview(requestId, index) {
  if (!canUseNativeSketchPreview()) return;
  if (els.generationNotice) {
      els.generationNotice.textContent = "正在生成当前人员的源文件预览...";
  }

  const formData = new FormData();
  formData.append("template", state.templateFile);
  formData.append("data", state.dataFile);
  formData.append("index", String(index));
  state.photoFiles.forEach((file) => formData.append("photos", file));

  try {
    const response = await fetch(apiUrl("/api/preview"), {
      method: "POST",
      body: formData,
    });
    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || "原生预览生成失败");
    }

    const meta = parsePreviewMeta(response.headers.get("X-Poster-Preview-Meta"));
    const blob = await response.blob();
    const image = await loadImageFromBlob(blob);
    if (requestId !== state.nativePreviewRequest || index !== state.activeIndex) return;
    state.nativePreview = { index, image };
    if (els.generationNotice) {
      els.generationNotice.textContent = meta
        ? `源文件预览：第 ${meta.row_number} 行 ${meta.data?.name || ""}；命中 ${formatMatchStats(meta.matches)}`
        : "当前画面已使用源文件导出预览，样式以源文件图层为准。";
    }
    drawPoster();
  } catch (error) {
    if (requestId !== state.nativePreviewRequest) return;
    state.nativePreviewError = error.message || "原生预览生成失败";
    if (els.generationNotice) {
      els.generationNotice.textContent = `本地服务未启动或预览失败。请双击启动文件后刷新页面。${error.message || ""}`;
    }
    drawPoster();
  }
}

function renderPosterBlob(index) {
  state.activeIndex = index;
  drawPoster();

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("当前预览图片生成失败"));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

async function batchProcessPosters() {
  if (state.builtInTemplate.comingSoon) return;
  if (!state.rows.length || state.isBatching) return;

  state.isBatching = true;
  const previousIndex = state.activeIndex;
  let finalStatus = "";
  let finalNotice = "";
  updateChrome();

  try {
    if (state.templateFile && state.templateFile.name.toLowerCase().endsWith(".sketch") && state.dataFile) {
      await batchProcessWithServer();
      finalStatus = "批量导出完成";
      finalNotice = "已按源文件样式导出压缩包，请在浏览器下载记录中查看。";
      return;
    }

    const files = [];
    for (let index = 0; index < state.rows.length; index += 1) {
      els.workflowStatus.textContent = `正在导出 ${index + 1} / ${state.rows.length}`;
      const blob = await renderPosterBlob(index);
      const row = state.rows[index] || {};
      const name = displayNameForRow(row, index);
      const prefix = state.builtInTemplate.outputPrefix || "海报";
      const safeName = sanitizeFileName(`${String(index + 1).padStart(3, "0")}-${prefix}-${name}.png`);
      files.push({ name: safeName, blob });
      await waitFrame();
    }

    if (!files.length) throw new Error("没有可导出的图片");

    els.workflowStatus.textContent = "正在打包压缩包";
    const zipBlob = await createZip(files);
    downloadBlob(zipBlob, `${sanitizeFileName(state.builtInTemplate.outputPrefix || "海报")}-批量输出.zip`);
    finalStatus = "批量导出完成";
    finalNotice = "已生成全部图片压缩包，请在浏览器下载记录中查看。";
  } catch (error) {
    finalStatus = "导出失败";
    finalNotice = `导出失败：${error.message || "请重新上传表格和照片后再试"}`;
    console.error(error);
  } finally {
    state.activeIndex = previousIndex;
    state.isBatching = false;
    drawPoster();
    renderPeopleStrip();
    updateChrome();
    if (finalStatus) {
      els.workflowStatus.textContent = finalStatus;
    }
    if (finalNotice && els.generationNotice) {
      els.generationNotice.textContent = finalNotice;
    }
  }
}

async function batchProcessWithServer() {
  els.workflowStatus.textContent = "正在调用源文件导出...";
  if (els.generationNotice) {
    els.generationNotice.textContent = "正在用源文件原生渲染批量生成，样式会以源文件为准。";
  }

  const formData = new FormData();
  formData.append("template", state.templateFile);
  formData.append("data", state.dataFile);
  state.photoFiles.forEach((file) => formData.append("photos", file));

  const response = await fetch(apiUrl("/api/generate"), {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "批量处理失败");
  }

  const blob = await response.blob();
  downloadBlob(blob, "海报批量输出.zip");
  els.workflowStatus.textContent = "批量处理完成";
  if (els.generationNotice) {
    els.generationNotice.textContent = "已按源文件样式导出压缩包。";
  }
}

function parsePreviewMeta(value) {
  if (!value) return null;
  try {
    return JSON.parse(decodeURIComponent(value));
  } catch {
    return null;
  }
}

function formatMatchStats(matches = {}) {
  const direct = matches.direct || {};
  const override = matches.override || {};
  return fixedFields
    .map((field) => `${fieldLabel(field)}：${Number(direct[field] || 0) + Number(override[field] || 0)}`)
    .join(" ");
}

function waitFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function sanitizeFileName(value) {
  return String(value)
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 120);
}

async function createZip(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const data = new Uint8Array(await file.blob.arrayBuffer());
    const nameBytes = encoder.encode(file.name);
    const crc = crc32(data);

    const localHeader = new Uint8Array(30);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, 0, true);
    localView.setUint16(12, 0, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);

    localParts.push(localHeader, nameBytes, data);

    const centralHeader = new Uint8Array(46);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 0, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    centralParts.push(centralHeader, nameBytes);

    offset += localHeader.length + nameBytes.length + data.length;
  }

  const centralOffset = offset;
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, centralOffset, true);

  return new Blob([...localParts, ...centralParts, endRecord], { type: "application/zip" });
}

function crc32(data) {
  let crc = -1;
  for (let i = 0; i < data.length; i += 1) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ data[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function downloadBlob(blob, filename) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = URL.createObjectURL(blob);
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(link.href);
    link.remove();
  }, 60000);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} 字节`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} 千字节`;
  return `${(bytes / 1024 / 1024).toFixed(1)} 兆字节`;
}

function bindDropZone(zone, input, handler, options = {}) {
  if (!zone || !input) return;
  zone.addEventListener("dragover", (event) => {
    event.preventDefault();
    zone.classList.add("dragging");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("dragging"));
  zone.addEventListener("drop", (event) => {
    event.preventDefault();
    zone.classList.remove("dragging");
    handler(options.multiple ? event.dataTransfer.files : event.dataTransfer.files[0]);
  });
  input.addEventListener("change", () => handler(options.multiple ? input.files : input.files[0]));
}

bindDropZone(els.dataDrop, els.dataInput, handleDataFile);
bindDropZone(els.photosDrop, els.photosInput, handlePhotoFiles, { multiple: true });

function syncMattingValues() {
  if (els.mattingToleranceValue && els.mattingTolerance) {
    els.mattingToleranceValue.textContent = els.mattingTolerance.value;
  }
  if (els.mattingFeatherValue && els.mattingFeather) {
    els.mattingFeatherValue.textContent = els.mattingFeather.value;
  }
}

els.mattingTolerance?.addEventListener("input", syncMattingValues);
els.mattingFeather?.addEventListener("input", syncMattingValues);
els.removeWhiteBg?.addEventListener("click", removeWhiteBackgroundFromPhotos);
els.mattingOriginal?.addEventListener("click", useOriginalPhotos);
els.downloadMattedPhotos?.addEventListener("click", downloadMattedPhotos);
els.downloadMattedPreview?.addEventListener("click", downloadCurrentMattedPhoto);
els.mattingPrev?.addEventListener("click", () => {
  state.activeIndex = Math.max(0, state.activeIndex - 1);
  drawPoster();
  renderPeopleStrip();
});
els.mattingNext?.addEventListener("click", () => {
  state.activeIndex = Math.min(state.photoRecords.length - 1, state.activeIndex + 1);
  drawPoster();
  renderPeopleStrip();
});
els.generateAvatar3d?.addEventListener("click", generateAvatar3dPortraits);
els.avatarOriginal?.addEventListener("click", toggleAvatarOriginal);
els.downloadAvatarPreview?.addEventListener("click", downloadCurrentAvatar3d);
els.downloadAvatarBatch?.addEventListener("click", downloadAvatar3dBatch);
els.avatarStyle?.addEventListener("change", () => {
  if (els.avatar3dNotice) {
    els.avatar3dNotice.textContent = `已选择${styleLabel()}，点击生成后会按当前风格输出。`;
  }
});
els.avatarPrev?.addEventListener("click", () => {
  state.activeIndex = Math.max(0, state.activeIndex - 1);
  state.showAvatarOriginal = false;
  drawPoster();
  renderPeopleStrip();
});
els.avatarNext?.addEventListener("click", () => {
  state.activeIndex = Math.min(state.photoRecords.length - 1, state.activeIndex + 1);
  state.showAvatarOriginal = false;
  drawPoster();
  renderPeopleStrip();
});

els.prevPerson.addEventListener("click", () => {
  state.activeIndex = Math.max(0, state.activeIndex - 1);
  clearNativePreview();
  drawPoster();
  renderPeopleStrip();
});

els.nextPerson.addEventListener("click", () => {
  state.activeIndex = Math.min(state.rows.length - 1, state.activeIndex + 1);
  clearNativePreview();
  drawPoster();
  renderPeopleStrip();
});

els.downloadPreview.addEventListener("click", async () => {
  const row = state.rows[state.activeIndex] || {};
  const name = displayNameForRow(row, state.activeIndex) || "海报预览";
  try {
    const blob = await renderPosterBlob(state.activeIndex);
    downloadBlob(blob, `${sanitizeFileName(name)}.png`);
    if (els.generationNotice) {
      els.generationNotice.textContent = "当前预览图片已导出，请在浏览器下载记录中查看。";
    }
  } catch (error) {
    els.workflowStatus.textContent = "导出失败";
    if (els.generationNotice) {
      els.generationNotice.textContent = `当前预览导出失败：${error.message || "请重新预览后再试"}`;
    }
    console.error(error);
  }
});

els.batchProcess.addEventListener("click", batchProcessPosters);

setCanvasSize(state.builtInTemplate.width, state.builtInTemplate.height);
renderTemplateModules();
updateWorkflowPanels();
updateTemplateDetail();
updateDataRequirementText();
syncMattingValues();
drawPlaceholder();
updateChrome();
loadBuiltInAssets();
