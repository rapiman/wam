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

  // --- el sampler
  Sampler: ['Sampler', 'Sampler', 'Échantillonneur', 'Sampler-a', 'Сэмплер', 'サンプラー', '샘플러', '采样器', 'แซมเพลอร์'],
  Volumen: ['Volume', 'Volume', 'Volume', 'Bolumena', 'Громкость', '音量', '볼륨', '音量', 'ระดับเสียง'],
  Paneo: ['Pan', 'Pan', 'Panoramique', 'Panoramikoa', 'Панорама', 'パン', '팬', '声像', 'แพน'],
  Afinación: ['Tuning', 'Afinação', 'Accord', 'Afinazioa', 'Настройка', 'チューニング', '튜닝', '调音', 'การจูน'],
  Decaimiento: ['Decay', 'Decaimento', 'Déclin', 'Gainbehera', 'Спад', 'ディケイ', '디케이', '衰减', 'ดีเคย์'],
  Sostenido: ['Sustain', 'Sustentação', 'Maintien', 'Iraupena', 'Поддержка', 'サステイン', '서스테인', '延音', 'ซัสเทน'],
  Soltado: ['Release', 'Liberação', 'Relâchement', 'Askatzea', 'Затухание', 'リリース', '릴리스', '释放', 'รีลีส'],
  Sensibilidad: ['Velocity', 'Sensibilidade', 'Sensibilité', 'Sentikortasuna', 'Чувствительность', 'ベロシティ感度', '벨로시티 감도', '力度灵敏度', 'ความไวต่อแรงกด'],
  Desde: ['From', 'De', 'De', 'Hemendik', 'От', '下限', '시작', '从', 'จาก'],
  Hasta: ['To', 'Até', 'À', 'Hona', 'До', '上限', '끝', '到', 'ถึง'],
  Raíz: ['Root', 'Raiz', 'Fondamentale', 'Erroa', 'Корень', 'ルート', '루트', '根音', 'โน้ตราก'],
  'Golpe (batería)': ['One-shot (drums)', 'Disparo (bateria)', 'Coup (batterie)', 'Kolpea (bateria)', 'Удар (ударные)', 'ワンショット（ドラム）', '원샷 (드럼)', '单次触发（鼓）', 'วันช็อต (กลอง)'],
  Piano: ['Piano', 'Piano', 'Piano', 'Pianoa', 'Фортепиано', 'ピアノ', '피아노', '钢琴', 'เปียโน'],
  Batería: ['Drums', 'Bateria', 'Batterie', 'Bateria', 'Ударные', 'ドラム', '드럼', '鼓', 'กลอง'],
  'Nueva zona de piano': ['New piano zone', 'Nova zona de piano', 'Nouvelle zone de piano', 'Piano-eremu berria', 'Новая зона фортепиано', '新しいピアノゾーン', '새 피아노 존', '新建钢琴区域', 'โซนเปียโนใหม่'],
  'Nueva zona de batería': ['New drum zone', 'Nova zona de bateria', 'Nouvelle zone de batterie', 'Bateria-eremu berria', 'Новая зона ударных', '新しいドラムゾーン', '새 드럼 존', '新建鼓区域', 'โซนกลองใหม่'],
  General: ['General', 'Geral', 'Général', 'Orokorra', 'Общее', '全般', '일반', '常规', 'ทั่วไป'],
  Color: ['Color', 'Cor', 'Couleur', 'Kolorea', 'Окраска', 'カラー', '컬러', '音色', 'สีสัน'],
  'Vaivén 1': ['LFO 1', 'LFO 1', 'LFO 1', 'LFO 1', 'LFO 1', 'LFO 1', 'LFO 1', 'LFO 1', 'LFO 1'],
  'Vaivén 2': ['LFO 2', 'LFO 2', 'LFO 2', 'LFO 2', 'LFO 2', 'LFO 2', 'LFO 2', 'LFO 2', 'LFO 2'],
  Corte: ['Cutoff', 'Corte', 'Coupure', 'Ebaketa', 'Срез', 'カットオフ', '컷오프', '截止', 'คัตออฟ'],
  Envolvente: ['Envelope', 'Envelope', 'Enveloppe', 'Inguratzailea', 'Огибающая', 'エンベロープ', '엔벌로프', '包络', 'เอนเวโลป'],
  'Envolvente del filtro': ['Filter envelope', 'Envelope do filtro', 'Enveloppe du filtre', 'Iragazkiaren inguratzailea', 'Огибающая фильтра', 'フィルターエンベロープ', '필터 엔벌로프', '滤波器包络', 'เอนเวโลปของฟิลเตอร์'],
  'Ataque del filtro': ['Filter attack', 'Ataque do filtro', 'Attaque du filtre', 'Iragazkiaren erasoa', 'Атака фильтра', 'フィルターのアタック', '필터 어택', '滤波器起音', 'แอทแทคของฟิลเตอร์'],
  Caída: ['Decay', 'Queda', 'Chute', 'Jaitsiera', 'Спад', 'ディケイ', '디케이', '衰减', 'ดีเคย์'],
  'Caída del filtro': ['Filter decay', 'Queda do filtro', 'Chute du filtre', 'Iragazkiaren jaitsiera', 'Спад фильтра', 'フィルターのディケイ', '필터 디케이', '滤波器衰减', 'ดีเคย์ของฟิลเตอร์'],
  Distorsión: ['Distortion', 'Distorção', 'Distorsion', 'Distortsioa', 'Искажение', 'ディストーション', '디스토션', '失真', 'ดิสทอร์ชัน'],
  'Mezcla de la distorsión': ['Distortion mix', 'Mistura da distorção', 'Mélange de la distorsion', 'Distortsioaren nahasketa', 'Микс искажения', 'ディストーションのミックス', '디스토션 믹스', '失真混合', 'มิกซ์ของดิสทอร์ชัน'],
  Ruido: ['Noise', 'Ruído', 'Bruit', 'Zarata', 'Шум', 'ノイズ', '노이즈', '噪声', 'นอยส์'],
  Desafinado: ['Detune', 'Desafinação', 'Désaccord', 'Desafinazioa', 'Расстройка', 'デチューン', '디튠', '失谐', 'ดีจูน'],
  Sub: ['Sub', 'Sub', 'Sub', 'Sub', 'Саб', 'サブ', '서브', '副振荡器', 'ซับ'],
  Octava: ['Octave', 'Oitava', 'Octave', 'Zortzidun', 'Октава', 'オクターブ', '옥타브', '八度', 'อ็อกเทฟ'],
  'Octava del sub': ['Sub octave', 'Oitava do sub', 'Octave du sub', 'Subaren zortziduna', 'Октава саба', 'サブのオクターブ', '서브 옥타브', '副振荡器八度', 'อ็อกเทฟของซับ'],
  'Forma del sub': ['Sub shape', 'Forma do sub', 'Forme du sub', 'Subaren forma', 'Форма саба', 'サブの波形', '서브 파형', '副振荡器波形', 'รูปคลื่นของซับ'],
  Apagado: ['Off', 'Desligado', 'Éteint', 'Itzalita', 'Выкл.', 'オフ', '끔', '关闭', 'ปิด'],
  Sierra: ['Saw', 'Serra', 'Scie', 'Zerra', 'Пила', 'ノコギリ', '톱니', '锯齿', 'ฟันเลื่อย'],
  Azar: ['Random', 'Aleatório', 'Aléatoire', 'Ausazkoa', 'Случайно', 'ランダム', '랜덤', '随机', 'สุ่ม'],
  Altura: ['Pitch', 'Altura', 'Hauteur', 'Altuera', 'Высота', 'ピッチ', '피치', '音高', 'ระดับเสียง'],
  Destino: ['Target', 'Destino', 'Cible', 'Helburua', 'Цель', '送り先', '대상', '目标', 'ปลายทาง'],
  'Forma del vaivén 1': ['LFO 1 shape', 'Forma do LFO 1', 'Forme du LFO 1', 'LFO 1aren forma', 'Форма LFO 1', 'LFO 1の波形', 'LFO 1 파형', 'LFO 1 波形', 'รูปคลื่นของ LFO 1'],
  'Forma del vaivén 2': ['LFO 2 shape', 'Forma do LFO 2', 'Forme du LFO 2', 'LFO 2aren forma', 'Форма LFO 2', 'LFO 2の波形', 'LFO 2 파형', 'LFO 2 波形', 'รูปคลื่นของ LFO 2'],
  'Velocidad del vaivén 1': ['LFO 1 rate', 'Velocidade do LFO 1', 'Vitesse du LFO 1', 'LFO 1aren abiadura', 'Скорость LFO 1', 'LFO 1の速さ', 'LFO 1 속도', 'LFO 1 速率', 'ความเร็วของ LFO 1'],
  'Velocidad del vaivén 2': ['LFO 2 rate', 'Velocidade do LFO 2', 'Vitesse du LFO 2', 'LFO 2aren abiadura', 'Скорость LFO 2', 'LFO 2の速さ', 'LFO 2 속도', 'LFO 2 速率', 'ความเร็วของ LFO 2'],
  'Profundidad del vaivén 1': ['LFO 1 depth', 'Profundidade do LFO 1', 'Profondeur du LFO 1', 'LFO 1aren sakonera', 'Глубина LFO 1', 'LFO 1の深さ', 'LFO 1 깊이', 'LFO 1 深度', 'ความลึกของ LFO 1'],
  'Profundidad del vaivén 2': ['LFO 2 depth', 'Profundidade do LFO 2', 'Profondeur du LFO 2', 'LFO 2aren sakonera', 'Глубина LFO 2', 'LFO 2の深さ', 'LFO 2 깊이', 'LFO 2 深度', 'ความลึกของ LFO 2'],
  'Destino del vaivén 1': ['LFO 1 target', 'Destino do LFO 1', 'Cible du LFO 1', 'LFO 1aren helburua', 'Цель LFO 1', 'LFO 1の送り先', 'LFO 1 대상', 'LFO 1 目标', 'ปลายทางของ LFO 1'],
  'Destino del vaivén 2': ['LFO 2 target', 'Destino do LFO 2', 'Cible du LFO 2', 'LFO 2aren helburua', 'Цель LFO 2', 'LFO 2の送り先', 'LFO 2 대상', 'LFO 2 目标', 'ปลายทางของ LFO 2'],
  'Estirar al tempo': ['Stretch to tempo', 'Esticar ao tempo', 'Étirer au tempo', 'Tempora luzatu', 'Растянуть под темп', 'テンポに合わせて伸縮', '템포에 맞춰 늘이기', '按速度伸缩', 'ยืดตามจังหวะ'],
  'Sin estirar': ['No stretch', 'Sem esticar', 'Sans étirer', 'Luzatu gabe', 'Без растяжения', '伸縮なし', '늘이지 않음', '不伸缩', 'ไม่ยืด'],
  Tiempos: ['Beats', 'Tempos', 'Temps', 'Taupadak', 'Доли', '拍', '박', '拍', 'จังหวะ'],
  Fuente: ['Source', 'Fonte', 'Source', 'Iturria', 'Источник', 'ソース', '소스', '来源', 'แหล่งเสียง'],
  Audio: ['Audio', 'Áudio', 'Audio', 'Audioa', 'Аудио', 'オーディオ', '오디오', '音频', 'เสียง'],
  Oscilador: ['Oscillator', 'Oscilador', 'Oscillateur', 'Osziladorea', 'Осциллятор', 'オシレーター', '오실레이터', '振荡器', 'ออสซิลเลเตอร์'],
  Milisegundos: ['Milliseconds', 'Milissegundos', 'Millisecondes', 'Milisegundoak', 'Миллисекунды', 'ミリ秒', '밀리초', '毫秒', 'มิลลิวินาที'],
  Tajadas: ['Slices', 'Fatias', 'Tranches', 'Xerrak', 'Нарезка', 'スライス', '슬라이스', '切片', 'สไลซ์'],
  'Nueva zona de tajadas': ['New slice zone', 'Nova zona de fatias', 'Nouvelle zone de tranches', 'Xerra-eremu berria', 'Новая зона нарезки', '新しいスライスゾーン', '새 슬라이스 존', '新建切片区域', 'โซนสไลซ์ใหม่'],
  Detectar: ['Detect', 'Detectar', 'Détecter', 'Detektatu', 'Найти', '検出', '감지', '检测', 'ตรวจหา'],
  'Detectar los golpes': ['Detect the hits', 'Detectar os golpes', 'Détecter les attaques', 'Detektatu kolpeak', 'Найти удары', 'アタックを検出', '타격 감지', '检测敲击', 'ตรวจหาจังหวะกระทบ'],
  Partes: ['Parts', 'Partes', 'Parties', 'Zatiak', 'Части', '分割数', '분할 수', '份数', 'จำนวนส่วน'],
  'Partes iguales': ['Equal parts', 'Partes iguais', 'Parts égales', 'Zati berdinak', 'Равные части', '均等に分割', '균등 분할', '等分', 'แบ่งเท่า ๆ กัน'],
  'Clic: oír la tajada · doble clic: agregar o quitar un corte': ['Click: hear the slice · double-click: add or remove a cut', 'Clique: ouvir a fatia · duplo clique: adicionar ou tirar um corte', 'Clic : écouter la tranche · double clic : ajouter ou retirer une coupe', 'Klik: entzun xerra · klik bikoitza: gehitu edo kendu ebaki bat', 'Щелчок: прослушать фрагмент · двойной щелчок: добавить или убрать разрез', 'クリック: スライスを試聴 · ダブルクリック: カットを追加・削除', '클릭: 슬라이스 듣기 · 더블 클릭: 자르기 추가 또는 제거', '单击：试听切片 · 双击：添加或删除切点', 'คลิก: ฟังสไลซ์ · ดับเบิลคลิก: เพิ่มหรือลบจุดตัด'],
  'Borrar zona': ['Delete zone', 'Apagar zona', 'Supprimer la zone', 'Ezabatu eremua', 'Удалить зону', 'ゾーンを削除', '존 삭제', '删除区域', 'ลบโซน'],
  Zona: ['Zone', 'Zona', 'Zone', 'Eremua', 'Зона', 'ゾーン', '존', '区域', 'โซน'],
  Zonas: ['Zones', 'Zonas', 'Zones', 'Eremuak', 'Зоны', 'ゾーン', '존', '区域', 'โซน'],
  Capa: ['Layer', 'Camada', 'Couche', 'Geruza', 'Слой', 'レイヤー', '레이어', '层', 'เลเยอร์'],
  'Abrir archivo': ['Open file', 'Abrir arquivo', 'Ouvrir un fichier', 'Ireki fitxategia', 'Открыть файл', 'ファイルを開く', '파일 열기', '打开文件', 'เปิดไฟล์'],
  'Quitar capa': ['Remove layer', 'Tirar camada', 'Retirer la couche', 'Kendu geruza', 'Убрать слой', 'レイヤーを削除', '레이어 제거', '移除层', 'นำเลเยอร์ออก'],
  'Dirección web del audio': ['Web address of the audio', 'Endereço web do áudio', 'Adresse web de l’audio', 'Audioaren web helbidea', 'Веб-адрес аудио', '音声のウェブアドレス', '오디오 웹 주소', '音频的网址', 'ที่อยู่เว็บของเสียง'],
  Cargar: ['Load', 'Carregar', 'Charger', 'Kargatu', 'Загрузить', '読み込む', '불러오기', '加载', 'โหลด'],
  Loop: ['Loop', 'Loop', 'Boucle', 'Begizta', 'Петля', 'ループ', '루프', '循环', 'ลูป'],
  Entrada: ['Start', 'Entrada', 'Entrée', 'Sarrera', 'Вход', 'アタック部', '시작부', '起始段', 'ช่วงต้น'],
  Release: ['Release', 'Release', 'Relâchement', 'Askatzea', 'Затухание', 'リリース部', '릴리스부', '释放段', 'ช่วงปล่อย'],
  'Con la altura de la nota:': ['Follows the note pitch:', 'Com a altura da nota:', 'Suit la hauteur de la note :', 'Notaren altuerarekin:', 'С высотой ноты:', 'ノートの音程に追従:', '노트 음높이 따름:', '跟随音高：', 'ตามระดับเสียงของโน้ต:'],
  'Clic en el teclado: elegir la zona · arrastrar las marcas: dónde parte, el loop y el fin': [
    'Click the keyboard: choose the zone · drag the markers: start, loop and end',
    'Clique no teclado: escolher a zona · arrastar as marcas: início, loop e fim',
    'Clic sur le clavier : choisir la zone · glisser les repères : début, boucle et fin',
    'Klik teklatuan: aukeratu eremua · arrastatu markak: hasiera, begizta eta amaiera',
    'Щелчок по клавиатуре: выбрать зону · перетаскивать метки: начало, петля и конец',
    '鍵盤をクリック: ゾーンを選択 · マーカーをドラッグ: 開始・ループ・終了',
    '건반 클릭: 존 선택 · 마커 드래그: 시작, 루프, 끝',
    '单击键盘：选择区域 · 拖动标记：起点、循环和终点',
    'คลิกคีย์บอร์ด: เลือกโซน · ลากเครื่องหมาย: จุดเริ่ม ลูป และจุดจบ',
  ],
  'Sin zonas: crear una de piano o de batería': ['No zones: create a piano or drum zone', 'Sem zonas: criar uma de piano ou de bateria', 'Aucune zone : en créer une de piano ou de batterie', 'Eremurik ez: sortu piano- edo bateria-eremu bat', 'Нет зон: создайте зону фортепиано или ударных', 'ゾーンなし: ピアノかドラムのゾーンを作成', '존 없음: 피아노 또는 드럼 존을 만드세요', '没有区域：创建一个钢琴或鼓区域', 'ไม่มีโซน: สร้างโซนเปียโนหรือกลอง'],
  'Sin audio: abrir un archivo o pegar una dirección': ['No audio: open a file or paste an address', 'Sem áudio: abrir um arquivo ou colar um endereço', 'Pas d’audio : ouvrir un fichier ou coller une adresse', 'Audiorik ez: ireki fitxategi bat edo itsatsi helbide bat', 'Нет аудио: откройте файл или вставьте адрес', '音声なし: ファイルを開くかアドレスを貼り付け', '오디오 없음: 파일을 열거나 주소를 붙여넣으세요', '没有音频：打开文件或粘贴地址', 'ไม่มีเสียง: เปิดไฟล์หรือวางที่อยู่'],
  'no se pudo abrir': ['could not be opened', 'não foi possível abrir', 'impossible d’ouvrir', 'ezin izan da ireki', 'не удалось открыть', '開けませんでした', '열 수 없음', '无法打开', 'เปิดไม่ได้'],
  'bajando…': ['downloading…', 'baixando…', 'téléchargement…', 'deskargatzen…', 'загрузка…', 'ダウンロード中…', '내려받는 중…', '下载中…', 'กำลังดาวน์โหลด…'],
  'no queda guardado': ['not saved', 'não fica salvo', 'non enregistré', 'ez da gordetzen', 'не сохраняется', '保存されません', '저장되지 않음', '不会保存', 'ไม่ได้บันทึก'],

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
