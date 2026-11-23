// LOS IDIOMAS DE LOS PLUGINS PROPIOS (2026-11-23, JP: «que cargue los idiomas»). Cada plugin trae
// sus textos en los diez idiomas de la interfaz de Pizarrita; no pasan por las traducciones del
// sitio. El castellano es la llave: el código escribe `t('Frecuencia')` y acá está cómo se dice.
//
// QUÉ IDIOMA: el de la página que aloja el plugin. En Pizarrita, `window.idioma` (ES, EN, PT…);
// en otro sitio, el `lang` de la página; si no, el del navegador. Se mira al armar la carátula y
// cada vez que alguien le pide al plugin sus parámetros: cambiado el idioma, la carátula nueva
// sale en el nuevo (la que está abierta sigue como estaba hasta volver a abrirla).
//
// Sin dependencias.

const IDIOMAS = ['EN', 'PT', 'FR', 'EU', 'RU', 'JA', 'KO', 'ZH', 'TH'];

// Por cada texto en castellano, en el orden de IDIOMAS.
const TEXTOS = {
  // --- los plugins
  Filtro: ['Filter', 'Filtro', 'Filtre', 'Iragazkia', 'Фильтр', 'フィルター', '필터', '滤波器', 'ฟิลเตอร์'],
  Chorus: ['Chorus', 'Chorus', 'Chorus', 'Chorus', 'Хорус', 'コーラス', '코러스', '合唱', 'คอรัส'],
  Flanger: ['Flanger', 'Flanger', 'Flanger', 'Flanger', 'Флэнджер', 'フランジャー', '플랜저', '镶边', 'แฟลนเจอร์'],
  Phaser: ['Phaser', 'Phaser', 'Phaser', 'Phaser', 'Фэйзер', 'フェイザー', '페이저', '移相', 'เฟสเซอร์'],
  Trémolo: ['Tremolo', 'Trêmolo', 'Trémolo', 'Tremoloa', 'Тремоло', 'トレモロ', '트레몰로', '颤音', 'เทรโมโล'],
  Ecualizador: ['Equalizer', 'Equalizador', 'Égaliseur', 'Ekualizadorea', 'Эквалайзер', 'イコライザー', '이퀄라이저', '均衡器', 'อีควอไลเซอร์'],
  Compresor: ['Compressor', 'Compressor', 'Compresseur', 'Konpresorea', 'Компрессор', 'コンプレッサー', '컴프레서', '压缩器', 'คอมเพรสเซอร์'],
  Limitador: ['Limiter', 'Limitador', 'Limiteur', 'Mugatzailea', 'Лимитер', 'リミッター', '리미터', '限制器', 'ลิมิตเตอร์'],

  // --- los parámetros
  Tipo: ['Type', 'Tipo', 'Type', 'Mota', 'Тип', 'タイプ', '유형', '类型', 'ประเภท'],
  Frecuencia: ['Frequency', 'Frequência', 'Fréquence', 'Maiztasuna', 'Частота', '周波数', '주파수', '频率', 'ความถี่'],
  Resonancia: ['Resonance', 'Ressonância', 'Résonance', 'Erresonantzia', 'Резонанс', 'レゾナンス', '레조넌스', '共振', 'เรโซแนนซ์'],
  Pendiente: ['Slope', 'Inclinação', 'Pente', 'Malda', 'Крутизна', 'スロープ', '기울기', '斜率', 'ความชัน'],
  Velocidad: ['Rate', 'Velocidade', 'Vitesse', 'Abiadura', 'Скорость', '速さ', '속도', '速度', 'ความเร็ว'],
  Vaivén: ['Sweep', 'Oscilação', 'Balayage', 'Kulunka', 'Качание', '揺れ幅', '흔들림', '摆动', 'การแกว่ง'],
  Mezcla: ['Mix', 'Mistura', 'Mélange', 'Nahasketa', 'Смесь', 'ミックス', '믹스', '混合', 'มิกซ์'],
  Retardo: ['Delay', 'Atraso', 'Retard', 'Atzerapena', 'Задержка', 'ディレイ', '딜레이', '延迟', 'ดีเลย์'],
  Realimentación: ['Feedback', 'Realimentação', 'Réinjection', 'Atzeraelikadura', 'Обратная связь', 'フィードバック', '피드백', '反馈', 'ฟีดแบ็ก'],
  Ancho: ['Width', 'Largura', 'Largeur', 'Zabalera', 'Ширина', '幅', '폭', '宽度', 'ความกว้าง'],
  Centro: ['Center', 'Centro', 'Centre', 'Erdigunea', 'Центр', '中心', '중심', '中心', 'จุดกลาง'],
  Etapas: ['Stages', 'Estágios', 'Étages', 'Etapak', 'Ступени', '段数', '단계', '级数', 'จำนวนขั้น'],
  Profundidad: ['Depth', 'Profundidade', 'Profondeur', 'Sakonera', 'Глубина', '深さ', '깊이', '深度', 'ความลึก'],
  Forma: ['Shape', 'Forma', 'Forme', 'Forma', 'Форма', '波形', '파형', '波形', 'รูปคลื่น'],
  'Entre orejas': ['Between ears', 'Entre ouvidos', 'Entre les oreilles', 'Belarrien artean', 'Между ушами', '左右の位相', '좌우 위상', '左右相位', 'ระหว่างหูซ้ายขวา'],
  Umbral: ['Threshold', 'Limiar', 'Seuil', 'Atalasea', 'Порог', 'スレッショルド', '스레숄드', '阈值', 'เทรชโฮลด์'],
  Razón: ['Ratio', 'Razão', 'Ratio', 'Erlazioa', 'Соотношение', 'レシオ', '비율', '比率', 'อัตราส่วน'],
  Ataque: ['Attack', 'Ataque', 'Attaque', 'Erasoa', 'Атака', 'アタック', '어택', '启动', 'แอทแทค'],
  Relajación: ['Release', 'Liberação', 'Relâchement', 'Askatzea', 'Восстановление', 'リリース', '릴리스', '释放', 'รีลีส'],
  Rodilla: ['Knee', 'Joelho', 'Genou', 'Belauna', 'Колено', 'ニー', '니', '拐点', 'นี'],
  Ganancia: ['Gain', 'Ganho', 'Gain', 'Irabazia', 'Усиление', 'ゲイン', '게인', '增益', 'เกน'],
  Techo: ['Ceiling', 'Teto', 'Plafond', 'Sabaia', 'Потолок', 'シーリング', '실링', '上限', 'เพดาน'],
  Salida: ['Output', 'Saída', 'Sortie', 'Irteera', 'Выход', '出力', '출력', '输出', 'เอาต์พุต'],
  Encendida: ['On', 'Ligada', 'Activée', 'Piztuta', 'Включена', 'オン', '켜짐', '开启', 'เปิด'],
  'Tipo de banda': ['Band type', 'Tipo de banda', 'Type de bande', 'Banda mota', 'Тип полосы', 'バンドの種類', '밴드 유형', '频段类型', 'ประเภทแบนด์'],
  'Pendiente del corte': ['Cut slope', 'Inclinação do corte', 'Pente de coupure', 'Ebakiaren malda', 'Крутизна среза', 'カットのスロープ', '컷 기울기', '切除斜率', 'ความชันของการตัด'],
  Banda: ['Band', 'Banda', 'Bande', 'Banda', 'Полоса', 'バンド', '밴드', '频段', 'แบนด์'],
  tipo: ['type', 'tipo', 'type', 'mota', 'тип', '種類', '유형', '类型', 'ประเภท'],
  frecuencia: ['frequency', 'frequência', 'fréquence', 'maiztasuna', 'частота', '周波数', '주파수', '频率', 'ความถี่'],
  ganancia: ['gain', 'ganho', 'gain', 'irabazia', 'усиление', 'ゲイン', '게인', '增益', 'เกน'],
  'pendiente del corte': ['cut slope', 'inclinação do corte', 'pente de coupure', 'ebakiaren malda', 'крутизна среза', 'カットのスロープ', '컷 기울기', '切除斜率', 'ความชันของการตัด'],

  // --- las opciones
  'Pasa bajos': ['Low pass', 'Passa-baixas', 'Passe-bas', 'Behe-pasakoa', 'Нижних частот', 'ローパス', '로우패스', '低通', 'โลว์พาส'],
  'Pasa altos': ['High pass', 'Passa-altas', 'Passe-haut', 'Goi-pasakoa', 'Верхних частот', 'ハイパス', '하이패스', '高通', 'ไฮพาส'],
  'Pasa banda': ['Band pass', 'Passa-banda', 'Passe-bande', 'Banda-pasakoa', 'Полосовой', 'バンドパス', '밴드패스', '带通', 'แบนด์พาส'],
  Muesca: ['Notch', 'Rejeita-banda', 'Coupe-bande', 'Koska', 'Режекторный', 'ノッチ', '노치', '陷波', 'น็อตช์'],
  Campana: ['Bell', 'Sino', 'Cloche', 'Kanpaia', 'Колокол', 'ベル', '벨', '钟形', 'ระฆัง'],
  'Repisa baja': ['Low shelf', 'Prateleira baixa', 'Plateau grave', 'Apal baxua', 'Полка НЧ', 'ローシェルフ', '로우 셸프', '低架', 'โลว์เชลฟ์'],
  'Repisa alta': ['High shelf', 'Prateleira alta', 'Plateau aigu', 'Apal altua', 'Полка ВЧ', 'ハイシェルフ', '하이 셸프', '高架', 'ไฮเชลฟ์'],
  'Corte bajo': ['Low cut', 'Corte baixo', 'Coupe-bas', 'Behe-ebakia', 'Срез НЧ', 'ローカット', '로우 컷', '低切', 'โลว์คัต'],
  'Corte alto': ['High cut', 'Corte alto', 'Coupe-haut', 'Goi-ebakia', 'Срез ВЧ', 'ハイカット', '하이 컷', '高切', 'ไฮคัต'],
  Seno: ['Sine', 'Senoide', 'Sinus', 'Sinua', 'Синус', 'サイン', '사인', '正弦', 'ไซน์'],
  Triángulo: ['Triangle', 'Triângulo', 'Triangle', 'Triangelua', 'Треугольник', '三角', '삼각', '三角', 'สามเหลี่ยม'],
  Cuadrada: ['Square', 'Quadrada', 'Carré', 'Karratua', 'Прямоугольная', '矩形', '사각', '方波', 'สี่เหลี่ยม'],

  // --- las ayudas
  'Doble clic: banda nueva o apagarla · arrastrar: mover · rueda: Q': [
    'Double-click: new band or turn it off · drag: move · wheel: Q',
    'Duplo clique: banda nova ou desligá-la · arrastar: mover · roda: Q',
    'Double-clic : nouvelle bande ou l’éteindre · glisser : déplacer · molette : Q',
    'Klik bikoitza: banda berria edo itzali · arrastatu: mugitu · gurpila: Q',
    'Двойной щелчок: новая полоса или выключить · перетащить: сдвинуть · колесо: Q',
    'ダブルクリック: バンド追加またはオフ · ドラッグ: 移動 · ホイール: Q',
    '더블클릭: 새 밴드 또는 끄기 · 드래그: 이동 · 휠: Q',
    '双击：新建频段或关闭 · 拖动：移动 · 滚轮：Q',
    'ดับเบิลคลิก: เพิ่มแบนด์หรือปิด · ลาก: ย้าย · ล้อเมาส์: Q',
  ],

  // --- los gráficos
  'cómo está': ['before', 'como está', 'avant', 'aurretik', 'до', '処理前', '처리 전', '处理前', 'ก่อน'],
  'cómo queda': ['after', 'como fica', 'après', 'ondoren', 'после', '処理後', '처리 후', '处理后', 'หลัง'],
  'cómo queda (izquierda)': ['after (left)', 'como fica (esquerda)', 'après (gauche)', 'ondoren (ezkerra)', 'после (левый)', '処理後（左）', '처리 후 (왼쪽)', '处理后（左）', 'หลัง (ซ้าย)'],
  derecha: ['right', 'direita', 'droite', 'eskuina', 'правый', '右', '오른쪽', '右', 'ขวา'],
  reducción: ['reduction', 'redução', 'réduction', 'murrizketa', 'снижение', 'リダクション', '리덕션', '衰减', 'การลดทอน'],
  Reducción: ['Reduction', 'Redução', 'Réduction', 'Murrizketa', 'Снижение', 'リダクション', '리덕션', '衰减', 'การลดทอน'],
  'la onda del volumen (sin sonido todavía)': [
    'the volume wave (no sound yet)',
    'a onda do volume (ainda sem som)',
    'l’onde du volume (pas encore de son)',
    'bolumenaren uhina (oraindik soinurik gabe)',
    'волна громкости (звука пока нет)',
    '音量の波形（まだ音なし）',
    '볼륨 파형 (아직 소리 없음)',
    '音量波形（尚无声音）',
    'คลื่นระดับเสียง (ยังไม่มีเสียง)',
  ],
  'la onda del volumen de cada oreja (sin sonido todavía)': [
    'the volume wave of each ear (no sound yet)',
    'a onda do volume de cada ouvido (ainda sem som)',
    'l’onde du volume de chaque oreille (pas encore de son)',
    'belarri bakoitzeko bolumenaren uhina (oraindik soinurik gabe)',
    'волна громкости для каждого уха (звука пока нет)',
    '左右それぞれの音量の波形（まだ音なし）',
    '각 귀의 볼륨 파형 (아직 소리 없음)',
    '每只耳朵的音量波形（尚无声音）',
    'คลื่นระดับเสียงของแต่ละหู (ยังไม่มีเสียง)',
  ],
};

// El idioma de la página, como código de Pizarrita (ES, EN, PT…). Lo que no está, castellano.
export function idioma() {
  try {
    const w = typeof window !== 'undefined' ? window : null;
    const crudo = (w && w.idioma) || (typeof document !== 'undefined' && document.documentElement.lang) || (typeof navigator !== 'undefined' && navigator.language) || 'es';
    const c = String(crudo).slice(0, 2).toUpperCase();
    return c === 'ES' || IDIOMAS.includes(c) ? c : 'ES';
  } catch (e) {
    return 'ES';
  }
}

// Un texto en el idioma de la página. Lo que no está en la tabla sale como vino.
export function t(texto, cual = idioma()) {
  const fila = TEXTOS[texto];
  const i = IDIOMAS.indexOf(cual);
  return fila && i >= 0 ? fila[i] : texto;
}

// El nombre de un parámetro tal como lo declara el hilo de audio (que no sabe de idiomas): los
// simples por la tabla; los del ecualizador, «Banda 3: frecuencia», por partes.
export function tEtiqueta(texto, cual = idioma()) {
  if (TEXTOS[texto]) return t(texto, cual);
  const m = /^Banda (\d+)(?:: (.+))?$/.exec(String(texto));
  if (!m) return texto;
  return `${t('Banda', cual)} ${m[1]}${m[2] ? `: ${t(m[2], cual)}` : ''}`;
}

// Lo que devuelve `getParameterInfo`, con nombres y opciones en el idioma de la página.
export function traducirInfo(info, cual = idioma()) {
  if (!info || cual === 'ES') return info;
  const sal = {};
  for (const id of Object.keys(info)) {
    const x = info[id];
    if (!x || typeof x !== 'object') {
      sal[id] = x;
      continue;
    }
    const copia = Object.assign(Object.create(Object.getPrototypeOf(x)), x);
    if (typeof x.label === 'string') copia.label = tEtiqueta(x.label, cual);
    if (Array.isArray(x.choices)) copia.choices = x.choices.map((c) => t(String(c), cual));
    sal[id] = copia;
  }
  return sal;
}

// Para la prueba: que cada fila tenga los nueve idiomas.
export const _TEXTOS = TEXTOS;
export const _IDIOMAS = IDIOMAS;
