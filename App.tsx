import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Settings, X, Cat, Trophy, RotateCcw, Upload, Image as ImageIcon, Plus, Trash2, Percent, Coins, MessageSquare, Cloud, Link as LinkIcon, Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ScratchCanvas from './components/ScratchCanvas';
import ResultModal from './components/ResultModal';
import { generateDeck, SoundManager, triggerHaptic } from './utils';
import { GameService } from "./services/gameService";
import { GameConfig, GameResult } from './types';
import { useAuth } from './hooks/useAuth';
import { useCards } from './hooks/useCards';
import { ensureAuth } from './firebaseConfig';

// --- Configuration & Types ---

const REVEAL_THRESHOLD = 90; // % to auto-complete (set to 1 for testing)

// --- Utility: Get Admin Status ---
const checkAdmin = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get("admin") === "true";
};

// --- Default Config (Fallback) ---
const DEFAULT_CONFIG: GameConfig = {
  totalCards: 100,
  tiers: [
    { count: 1, amount: 5000 },  // Jackpot
    { count: 5, amount: 500 },   // Big
    { count: 15, amount: 50 },   // Medium
    { count: 30, amount: 10 },   // Small
  ],
  winMessage: "恭喜中獎!",
  loseMessage: "沒中獎...",
  scratchSound: "https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.m4a", // Default scratch sound
  bgMusic: "",
  bgMusicLoopStart: 0,
  bgMusicLoopEnd: 0,
  bgMusicEnabled: true,
};

// Hard-coded BGM path — file lives in public/bgm.mp3
const DEFAULT_BGM = `${import.meta.env.BASE_URL}bgm.mp3`;

// --- Default SVG Cover (Fallback) ---
const DEFAULT_COVER = `data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='600' viewBox='0 0 400 600'%3E%3Cdefs%3E%3ClinearGradient id='bg' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23FCD34D'/%3E%3Cstop offset='100%25' stop-color='%23F59E0B'/%3E%3C/linearGradient%3E%3Cpattern id='pattern' width='40' height='40' patternUnits='userSpaceOnUse'%3E%3Ccircle cx='20' cy='20' r='2' fill='%23FFFFFF' opacity='0.3'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='100%25' height='100%25' fill='url(%23bg)'/%3E%3Crect width='100%25' height='100%25' fill='url(%23pattern)'/%3E%3Ccircle cx='200' cy='220' r='100' fill='%23FFFBEB' stroke='%23FBBF24' stroke-width='8'/%3E%3Cpath d='M160 180 Q200 220 240 180 Q260 140 220 120 Q200 140 180 120 Q140 140 160 180' fill='%23F59E0B'/%3E%3Ctext x='200' y='400' font-family='sans-serif' font-weight='900' font-size='48' fill='%2378350F' text-anchor='middle' stroke='%23FFF' stroke-width='2'%3ELUCKY%3C/text%3E%3Ctext x='200' y='450' font-family='sans-serif' font-weight='900' font-size='48' fill='%2378350F' text-anchor='middle' stroke='%23FFF' stroke-width='2'%3EPAWS%3C/text%3E%3Crect x='50' y='500' width='300' height='60' rx='30' fill='%23FFFFFF' stroke='%2378350F' stroke-width='4'/%3E%3Ctext x='200' y='542' font-family='sans-serif' font-weight='bold' font-size='24' fill='%23D97706' text-anchor='middle'%3ESCRATCH TO WIN%3C/text%3E%3C/svg%3E`;

const SOUND_MANAGER = new SoundManager();

// --- Components ---

const SettingsPanel: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  config: GameConfig;
  setConfig: (c: GameConfig) => void;
  onRegenerate: () => void;
  onUploadCover: (file: File) => void;
  currentCover: string;
  onSave?: () => void;
  onShare?: () => void;
  isSyncing?: boolean;
  onShareSnapshot?: () => void;
  onResetLocks?: () => void;
  onResetProgress?: () => void;
}> = ({ isOpen, onClose, config, setConfig, onRegenerate, onUploadCover, currentCover, onSave, onShare, isSyncing, onShareSnapshot, onResetLocks, onResetProgress }) => {

  // Helper to update a tier
  const updateTier = (index: number, field: 'count' | 'amount', value: number) => {
    const newTiers = [...config.tiers];
    newTiers[index] = { ...newTiers[index], [field]: value };
    setConfig({ ...config, tiers: newTiers });
  };

  // Add a new empty tier
  const addTier = () => {
    setConfig({
      ...config,
      tiers: [...config.tiers, { count: 1, amount: 10 }]
    });
  };

  // Remove a tier
  const removeTier = (index: number) => {
    const newTiers = config.tiers.filter((_, i) => i !== index);
    setConfig({ ...config, tiers: newTiers });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onUploadCover(file);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h3 className="text-2xl font-black text-gray-800 flex items-center gap-2">
                <Settings className="text-orange-500" /> 遊戲設定 (Settings)
              </h3>
              <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6">

              {/* Cover Image Upload */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <h4 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                  <ImageIcon size={18} className="text-purple-500" /> 卡片外觀 (Appearance)
                </h4>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-20 rounded-lg overflow-hidden border border-gray-300 shadow-sm flex-shrink-0 bg-white">
                    <img src={currentCover} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 mb-2">上傳您的自訂封面 (例如貓咪圖)。</p>
                    <label className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-bold text-gray-700 cursor-pointer hover:bg-gray-50 transition shadow-sm">
                      <Upload size={16} />
                      上傳圖片
                      <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                    </label>
                  </div>
                </div>
              </div>

              {/* Messages Config */}
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                <h4 className="font-bold text-blue-800 mb-2 flex items-center gap-2">
                  <MessageSquare size={18} /> 結果訊息 (Messages)
                </h4>
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">中獎文字 (Win Message)</label>
                    <input
                      type="text"
                      value={config.winMessage}
                      onChange={(e) => setConfig({ ...config, winMessage: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="恭喜中獎!"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">未中獎文字 (Lose Message)</label>
                    <input
                      type="text"
                      value={config.loseMessage}
                      onChange={(e) => setConfig({ ...config, loseMessage: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="沒中獎..."
                    />
                  </div>
                </div>
              </div>

            </div>

            {/* Background Music Config */}
            <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
              <h4 className="font-bold text-purple-800 mb-2 flex items-center gap-2 justify-between">
                <div className="flex items-center gap-2"><MessageSquare size={18} /> 背景音樂 (BGM)</div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.bgMusicEnabled}
                    onChange={(e) => setConfig({ ...config, bgMusicEnabled: e.target.checked })}
                    className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                  />
                  <span className="text-xs font-bold text-purple-700">開啟</span>
                </label>
              </h4>
              <div className="space-y-3">
                {/* External Music URL */}
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">音樂 URL (外部連結)</label>
                  <input
                    type="url"
                    placeholder="https://drive.google.com/file/d/xxx/view 或直接 MP3 連結"
                    value={config.bgMusic && !config.bgMusic.startsWith('blob:') ? config.bgMusic : ''}
                    onChange={(e) => setConfig({ ...config, bgMusic: e.target.value })}
                    onBlur={(e) => {
                      let url = e.target.value.trim();
                      // Auto-convert Google Drive share URL → direct download
                      const gdMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
                      if (gdMatch) {
                        url = `https://drive.google.com/uc?export=download&id=${gdMatch[1]}`;
                        setConfig({ ...config, bgMusic: url });
                      }
                      // Auto-convert Dropbox share URL → direct download
                      if (url.includes('dropbox.com') && url.includes('dl=0')) {
                        url = url.replace('dl=0', 'dl=1');
                        setConfig({ ...config, bgMusic: url });
                      }
                    }}
                    className="w-full border border-purple-200 rounded-lg px-3 py-2 font-bold text-gray-700 text-sm focus:ring-2 focus:ring-purple-400 focus:outline-none"
                  />
                  <p className="text-[9px] text-gray-400 mt-1">
                    直接貼 Google Drive 分享連結即可，系統會自動轉換成直連格式。
                  </p>
                  {config.bgMusic && (
                    <button
                      onClick={() => setConfig({ ...config, bgMusic: '' })}
                      className="text-[10px] text-red-500 font-bold mt-1 hover:underline"
                    >
                      ✕ 清除音樂
                    </button>
                  )}
                </div>

                {/* Loop Range */}
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">開始時間 (秒)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={config.bgMusicLoopStart || 0}
                      onChange={(e) => setConfig({ ...config, bgMusicLoopStart: Number(e.target.value) })}
                      className="w-full border rounded-lg px-2 py-1.5 font-bold text-gray-700 text-sm focus:ring-2 focus:ring-purple-400 focus:outline-none"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">結束時間 (秒)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      placeholder="0 (自動)"
                      value={config.bgMusicLoopEnd || 0}
                      onChange={(e) => setConfig({ ...config, bgMusicLoopEnd: Number(e.target.value) })}
                      className="w-full border rounded-lg px-2 py-1.5 font-bold text-gray-700 text-sm focus:ring-2 focus:ring-purple-400 focus:outline-none"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-gray-400">若結束時間為 0，則播放至結束。</p>
              </div>
            </div>

            {/* Prize Config */}
            <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
              <h4 className="font-bold text-orange-800 mb-2 flex items-center gap-2 justify-between">
                <div className="flex items-center gap-2"><Trophy size={18} /> 獎金分配 (Prize Rules)</div>
                <button
                  onClick={addTier}
                  className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded-md hover:bg-orange-200 flex items-center gap-1 font-bold"
                >
                  <Plus size={12} /> 新增獎項
                </button>
              </h4>
              <p className="text-xs text-orange-600/70 mb-3">總共 {config.totalCards} 張卡片，請設定中獎張數與金額。未分配的張數將自動視為 $0。</p>

              <div className="space-y-2">
                {config.tiers.map((tier, idx) => (
                  <div key={idx} className="flex items-center gap-3 bg-white p-2 rounded-lg border border-orange-100 shadow-sm">
                    <div className="flex-1">
                      <label className="text-[10px] font-bold text-gray-500 uppercase">張數 (Count)</label>
                      <input
                        type="number"
                        min="0"
                        value={tier.count}
                        onChange={(e) => updateTier(idx, 'count', parseInt(e.target.value) || 0)}
                        className="w-full border rounded-lg px-2 py-1.5 font-bold text-gray-700 text-sm"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] font-bold text-gray-500 uppercase">金額 ($)</label>
                      <input
                        type="number"
                        min="0"
                        value={tier.amount}
                        onChange={(e) => updateTier(idx, 'amount', parseInt(e.target.value) || 0)}
                        className="w-full border rounded-lg px-2 py-1.5 font-bold text-green-600 text-sm"
                      />
                    </div>
                    <div className="flex-none pt-4">
                      <button
                        onClick={() => removeTier(idx)}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition"
                        title="移除此規則"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
                {config.tiers.length === 0 && (
                  <div className="text-center py-4 text-gray-400 text-sm italic">
                    沒有獎項設定，所有卡片都將是 $0。
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3 pt-4 border-t border-gray-100 mt-6">
              <h4 className="font-bold text-gray-800 flex items-center gap-2">
                <Settings size={18} className="text-gray-400" /> 管理與操作 (Actions)
              </h4>
              <button
                onClick={() => { onRegenerate(); onClose(); }}
                className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transaction flex items-center justify-center gap-2"
              >
                <RotateCcw size={18} />
                重新產生牌組 (Local Preview)
              </button>

              {onSave && (
                <button
                  onClick={onSave}
                  disabled={isSyncing}
                  className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transform active:scale-95 transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSyncing ? <RotateCcw className="animate-spin" size={20} /> : <Cloud size={20} />}
                  {isSyncing ? "發布中..." : "儲存並發布到雲端 (Save & Deploy)"}
                </button>
              )}

              {onShare && (
                <button
                  onClick={onShare}
                  className="w-full py-3 bg-green-50 text-green-700 border border-green-200 rounded-xl font-bold hover:bg-green-100 transition flex items-center justify-center gap-2"
                >
                  <LinkIcon size={18} />
                  複製玩家專用連結
                </button>
              )}

              {onShareSnapshot && (
                <button
                  onClick={onShareSnapshot}
                  disabled={isSyncing}
                  className="w-full py-3 bg-purple-50 text-purple-700 border border-purple-200 rounded-xl font-bold hover:bg-purple-100 transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSyncing ? <RotateCcw className="animate-spin" size={18} /> : <Cloud size={18} />}
                  {isSyncing ? '產生中...' : '產生雲端分享連結'}
                </button>
              )}

              {onResetLocks && (
                <div className="flex gap-2">
                  <button
                    onClick={onResetLocks}
                    disabled={isSyncing}
                    className="flex-1 py-3 bg-red-50 text-red-700 border border-red-200 rounded-xl font-bold hover:bg-red-100 transition flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
                  >
                    <RotateCcw size={16} />
                    清除卡住鎖定
                  </button>
                  {onResetProgress && (
                    <button
                      onClick={onResetProgress}
                      disabled={isSyncing}
                      className="flex-1 py-3 bg-orange-50 text-orange-700 border border-orange-200 rounded-xl font-bold hover:bg-orange-100 transition flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
                    >
                      <RotateCcw size={16} />
                      重置所有進度
                    </button>
                  )}
                </div>
              )}
            </div>

          </motion.div>
        </motion.div >
      )}
    </AnimatePresence >
  );
};

// --- Game Row Component (Real Scratch Card Style) ---
const GameRow: React.FC<{
  game: { my: number; house: number; prize: number; isWin: boolean };
  index: number
}> = ({ game, index }) => {
  return (
    <div className="flex-1 flex flex-row items-stretch bg-white/50 backdrop-blur-sm border-b border-gray-300 last:border-0 relative">

      {/* Left: House Number (Opponent) + Prize Underneath */}
      <div className="flex-1 border-r border-gray-300 flex flex-col items-center justify-center bg-white/40 pt-1 pb-1">
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">對手號碼</span>
        <span className="text-5xl font-black text-gray-800 leading-none drop-shadow-sm font-mono mt-1 mb-0">
          {game.house < 10 ? `0${game.house}` : game.house}
        </span>
        {/* The Prize Underneath (Like image: 09 over $1000) */}
        <span className="text-sm font-black text-gray-700 tracking-tighter mt-1">
          ${game.prize.toLocaleString()}
        </span>
      </div>

      {/* Center VS */}
      <div className="w-12 flex items-center justify-center relative">
        <div className="text-xl font-black text-gray-400/30 italic absolute">VS</div>
      </div>

      {/* Right: My Number (Yours) - No Prize here */}
      <div className="flex-1 flex flex-col items-center justify-center bg-white/40">
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">您的號碼</span>

        {/* The Number */}
        <span className="text-5xl font-black text-gray-800 leading-none drop-shadow-sm font-mono">
          {game.my < 10 ? `0${game.my}` : game.my}
        </span>

        {/* Empty space to match height of prize */}
        <span className="text-xs font-black text-transparent tracking-tighter -mt-1 scale-y-90 select-none">
          $0
        </span>
      </div>
    </div>
  );
}

/**
 * Scratch Card Game View
 */
const ScratchCardGame: React.FC<{
  cardData: GameResult;
  coverImage: string;
  winMessage: string;
  loseMessage: string;
  onBack: () => void;
  onComplete: (id: number) => void;
  onProgressUpdate?: (percentage: number) => void;
  revealThreshold?: number;
}> = ({ cardData, coverImage, winMessage, loseMessage, onBack, onComplete, onProgressUpdate, revealThreshold = REVEAL_THRESHOLD }) => {
  // If card is already played, start as revealed
  const isAlreadyPlayed = cardData.isPlayed || cardData.status === 'completed';
  const [isRevealed, setIsRevealed] = useState(isAlreadyPlayed);
  const [showModal, setShowModal] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };
    // Slight delay to ensure layout is computed
    const timer = setTimeout(updateSize, 50);
    window.addEventListener('resize', updateSize);
    return () => {
      window.removeEventListener('resize', updateSize);
      clearTimeout(timer);
    };
  }, []);

  const handleScratchStart = () => {
    SOUND_MANAGER.playScratch();
  };

  const handleScratchEnd = () => {
    SOUND_MANAGER.stopScratch();
  };

  const handleRevealComplete = () => {
    if (!isRevealed) {
      triggerHaptic([20, 50, 20]);
      setIsRevealed(true);
      setShowModal(true); // <--- Add this to pop the result modal
      SOUND_MANAGER.stopScratch();
      onComplete(cardData.id);
    }
  };

  // Allow closing if revealed OR if it was already played before entering
  const canClose = isRevealed || isAlreadyPlayed || cardData.status === 'completed';

  return (
    <div className="min-h-screen bg-[#FFF8F0] flex flex-col items-center pt-6 pb-4 px-4 relative overflow-hidden">
      {/* Navbar */}
      <div className="w-full max-w-md flex justify-between items-center mb-4 z-10">
        <button
          onClick={onBack}
          disabled={!canClose}
          className={`p-3 bg-white rounded-full shadow-md transition border border-gray-100 ${canClose
            ? 'text-gray-600 hover:bg-gray-50 cursor-pointer'
            : 'text-gray-300 cursor-not-allowed opacity-50'
            }`}
        >
          <X size={24} />
        </button>
        <div className="bg-white border border-yellow-200 text-yellow-600 px-4 py-1.5 rounded-full text-sm font-bold shadow-sm">
          Card #{cardData.id}
        </div>
      </div>

      {/* Main Card Container */}
      <div className="w-full max-w-md aspect-[3/4.6] shadow-2xl rounded-3xl relative bg-white border-[6px] border-white overflow-hidden box-border">

        {/* UNDERNEATH LAYER: Full Bleed Content */}
        <div className="absolute inset-0 flex flex-col bg-gray-100">

          {/* Security Background Pattern */}
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#9ca3af 1px, transparent 1px)', backgroundSize: '12px 12px' }}></div>

          {/* Header */}
          <div className="flex-none h-20 bg-gradient-to-r from-orange-400 to-yellow-500 flex items-center justify-center shadow-md z-10 relative">
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(45deg, #ffffff 25%, transparent 25%, transparent 50%, #ffffff 50%, #ffffff 75%, transparent 75%, transparent)', backgroundSize: '10px 10px' }}></div>
            <div className="text-3xl font-black text-white tracking-widest drop-shadow-md z-10 uppercase italic">
              招財貓
            </div>
          </div>

          {/* Game Section (Rows) */}
          <div className="flex-1 flex flex-col relative z-0">
            <GameRow game={cardData.games[0]} index={0} />
            <GameRow game={cardData.games[1]} index={1} />
          </div>

          {/* Bonus Prize Footer (Full Bleed) */}
          <div className="h-40 bg-gradient-to-br from-purple-600 to-indigo-700 flex flex-col items-center justify-center relative overflow-hidden text-white shadow-[0_-4px_10px_rgba(0,0,0,0.1)] z-10">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, #ffffff 10px, #ffffff 20px)' }}></div>

            <span className="text-sm font-bold text-purple-200 tracking-widest mb-2 z-10 bg-purple-900/50 px-3 py-1 rounded-full border border-purple-400/30">
              幸運獎金區 (BONUS)
            </span>

            <div className="z-10 flex items-baseline relative flex-col items-center">
              {cardData.bonusPrize > 0 && (
                <span className="text-yellow-300 font-bold text-xs animate-pulse mb-1">
                  WINNER!
                </span>
              )}
              <span className="text-6xl font-black drop-shadow-lg tracking-tighter">
                ${cardData.bonusPrize.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* TOP LAYER: The Scratch Canvas - ONLY Render if NOT played yet */}
        {!isAlreadyPlayed && (
          <div className="absolute inset-0 z-20" ref={containerRef}>
            {size.width > 0 && (
              <ScratchCanvas
                width={size.width}
                height={size.height}
                imageSrc={coverImage}
                onScratchStart={handleScratchStart}
                onScratchEnd={handleScratchEnd}
                onRevealComplete={handleRevealComplete}
                onProgressUpdate={onProgressUpdate}
                isRevealed={isRevealed}
                revealThreshold={revealThreshold}
              />
            )}
          </div>
        )}
      </div>

      <ResultModal
        isOpen={showModal}
        result={cardData}
        onBackToList={onBack}
        onViewCard={() => setShowModal(false)}
        winMessage={winMessage}
        loseMessage={loseMessage}
      />
    </div>
  );
};

/**
 * Main App Component
 */
const App: React.FC = () => {
  // --- Auth & Cards Hooks ---
  const { uid, loading: authLoading } = useAuth();
  const params = new URLSearchParams(window.location.search);
  const snapshotId = params.get('id');
  const { cards: deck, config: cloudConfig, loading: cardsLoading, setCards: setDeck, setConfig: setCloudConfig } = useCards(snapshotId);

  // --- State ---
  const [config, setConfig] = useState<GameConfig>(DEFAULT_CONFIG);
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [winMessage, setWinMessage] = useState("");
  const [loseMessage, setLoseMessage] = useState("");
  const [coverImage, setCoverImage] = useState<string>(DEFAULT_COVER);

  // Admin & Network State
  const [isAdmin] = useState(checkAdmin());
  const [isSyncing, setIsSyncing] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const isViewOnly = !!snapshotId;
  const [isMusicOn, setIsMusicOn] = useState(true);

  // --- Local Sync Cache (Solves Ghost Locks & F5 Loops) ---
  const [localDone, setLocalDone] = useState<Set<number>>(new Set());

  // Load local cache on mount
  useEffect(() => {
    const saved = localStorage.getItem('local_completed_ids');
    if (saved) {
      try {
        setLocalDone(new Set(JSON.parse(saved)));
      } catch (e) {
        console.error('Failed to parse local_completed_ids', e);
      }
    }
  }, []);

  const addToLocalDone = (id: number) => {
    const next = new Set([...localDone, id]);
    setLocalDone(next);
    localStorage.setItem('local_completed_ids', JSON.stringify(Array.from(next)));
  };

  const clearLocalDone = () => {
    setLocalDone(new Set());
    localStorage.removeItem('local_completed_ids');
  };

  // Merge Firestore data with local "Done" cache
  const mergedDeck = useMemo(() => {
    return deck.map(c =>
      localDone.has(c.id) ? { ...c, status: 'completed' as const, isPlayed: true, progress: 100 } : c
    );
  }, [deck, localDone]);

  // Derived state
  const playedIds = useMemo(() => new Set(mergedDeck.filter(c => c.isPlayed || c.status === 'completed').map(c => c.id)), [mergedDeck]);

  // Sync cloud config to local config state
  useEffect(() => {
    if (cloudConfig) {
      setConfig(cloudConfig);
      if (cloudConfig.coverImage) setCoverImage(cloudConfig.coverImage);
    }
  }, [cloudConfig]);

  // If no cloud data and not snapshot mode, generate local deck
  useEffect(() => {
    if (!cardsLoading && !snapshotId && deck.length === 0 && !cloudConfig) {
      setDeck(generateDeck(DEFAULT_CONFIG));
    }
  }, [cardsLoading, snapshotId, deck.length, cloudConfig, setDeck]);

  // --- Phase 2: Anti-F5 auto-recovery ---
  const hasRecovered = useRef(false);
  useEffect(() => {
    if (authLoading || cardsLoading || !uid || isViewOnly || hasRecovered.current) return;
    // Check if user has an active (scratching) card
    const myActiveCard = mergedDeck.find(c => c.status === 'scratching' && c.lockedBy === uid);
    if (myActiveCard && !selectedCardId) {
      console.log('Anti-F5: recovering card', myActiveCard.id);
      setSelectedCardId(myActiveCard.id);
    }
    // Only run recovery once on initial load
    hasRecovered.current = true;
  }, [authLoading, cardsLoading, uid, mergedDeck, selectedCardId, isViewOnly]);

  // localStorage cache for active card (quick display before Firebase loads)
  useEffect(() => {
    if (selectedCardId !== null) {
      localStorage.setItem('active_card', String(selectedCardId));
    } else {
      localStorage.removeItem('active_card');
    }
  }, [selectedCardId]);

  // Update sound when config changes
  useEffect(() => {
    if (config.scratchSound) {
      SOUND_MANAGER.setScratchSound(config.scratchSound);
    }
    // Update Background Music — fallback to DEFAULT_BGM if config is empty
    const musicUrl = config.bgMusic || DEFAULT_BGM;
    SOUND_MANAGER.setBgMusic(musicUrl, config.bgMusicLoopStart, config.bgMusicLoopEnd);

    // Master switch: Config (Admin) AND Player toggle
    const shouldPlay = (config.bgMusicEnabled !== false) && isMusicOn;

    if (shouldPlay) {
      // Try to play immediately (works if user already interacted)
      SOUND_MANAGER.playBgMusic();
      // Also set up one-time listener for first interaction (autoplay policy)
      const startMusic = () => {
        if ((config.bgMusicEnabled !== false) && isMusicOn) {
          SOUND_MANAGER.playBgMusic();
        }
        document.removeEventListener('click', startMusic);
        document.removeEventListener('touchstart', startMusic);
      };
      document.addEventListener('click', startMusic, { once: true });
      document.addEventListener('touchstart', startMusic, { once: true });
    } else {
      SOUND_MANAGER.stopBgMusic();
    }
  }, [config.scratchSound, config.bgMusic, config.bgMusicLoopStart, config.bgMusicLoopEnd, config.bgMusicEnabled, isMusicOn]);

  const handleCardComplete = async (id: number) => {
    // 立即更新本地強效緩存 (解決 F5 與同步延遲問題)
    addToLocalDone(id);

    // Update local state immediately
    setDeck(prevDeck => prevDeck.map(card =>
      card.id === id ? { ...card, status: 'completed' as const, isPlayed: true, progress: 100, lockedBy: undefined, lockedAt: undefined } : card
    ));

    // Sync to Firestore
    try {
      await GameService.completeCard(id);
    } catch (err) {
      console.error('Failed to complete card:', err);
    }
  };

  // Handle card selection with locking + anti-cheat binding
  const handleSelectCard = async (cardId: number) => {
    // Ensure we have the latest UID (prevents race where hook uid is still null)
    const userId = await ensureAuth();
    if (!userId) return;

    // 1. If we ALREADY have this card locked (e.g. refresh/re-entry), just enter it
    const card = mergedDeck.find(c => c.id === cardId);
    if (card && (card.status === 'scratching' || localDone.has(card.id)) && card.lockedBy === userId) {
      setSelectedCardId(cardId);
      return;
    }

    // 2. Anti-cheat: if user already has A DIFFERENT scratching card, force back to it
    const myActiveCard = mergedDeck.find(c => c.status === 'scratching' && c.lockedBy === userId);
    // Relaxed check: if the card is NOT yet finished (< 90%), then we force them back.
    // If it is >= 90%, we let the call go to server, which will auto-complete it and lock the new one.
    if (myActiveCard && (myActiveCard.progress ?? 0) < 90) {
      setSelectedCardId(myActiveCard.id);
      return;
    }

    // 3. Try to lock the new card in Firestore
    const locked = await GameService.lockCard(cardId);
    if (locked) {
      setSelectedCardId(cardId);
    } else {
      alert('這張卡已被其他人選取或你已有進行中的卡片！');
    }
  };



  const regenerateDeckHandler = () => {
    clearLocalDone();
    setDeck(generateDeck(config));
  };

  const handleSaveToCloud = async () => {
    if (!confirm("確定要發布當前牌組到雲端嗎？這將覆蓋現有的雲端資料。")) return;

    // 清除本地緩存，因為發布了新牌組
    clearLocalDone();

    // Sanitize blob: URLs — they only work locally and break for other users
    const cleanConfig = {
      ...config,
      bgMusic: config.bgMusic?.startsWith('blob:') ? '' : config.bgMusic,
      coverImage: config.coverImage?.startsWith('blob:') ? '' : config.coverImage,
    };

    setIsSyncing(true);
    try {
      // IMPORTANT: Use the raw 'deck' state for saving. 
      // This ensures that if we just regenerated, we save the CLEAN cards.
      // If we are just updating config, 'deck' already contains the synced server statuses.
      await GameService.saveGameToCloud(cleanConfig, deck);
      alert("發布成功！所有玩家現在將看到最新的設定與牌組。");
      setShareUrl(window.location.origin + window.location.pathname);
    } catch (e) {
      console.error(e);
      alert("發布失敗，請檢查網路或 Firebase 設定。");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleShare = () => {
    const url = window.location.origin + window.location.pathname;
    navigator.clipboard.writeText(url).then(() => {
      alert("連結已複製到剪貼簿！可直接分享給玩家。");
    });
  };

  const handleShareCloudLink = async () => {
    setIsSyncing(true);
    try {
      const id = await GameService.saveCard(config, deck);
      let baseUrl = window.location.origin + window.location.pathname;
      // If localhost, point to GitHub Pages for convenience
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        baseUrl = "https://stevenbocheng.github.io/Scratch-off-card/";
      }
      const shareUrl = `${baseUrl}?id=${id}`;
      prompt("雲端連結已產生！請複製此連結：", shareUrl);
    } catch (err) {
      console.error(err);
      alert("產生連結失敗。");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUploadCover = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        const base64 = e.target.result as string;
        setCoverImage(base64);
        // Also save to config so it persists when saved to cloud
        setConfig(prev => ({ ...prev, coverImage: base64 }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleResetLocks = async () => {
    if (!confirm("確定要強制清除所有卡片的『刮獎中』狀態嗎？這通常在多人同時卡死時使用。")) return;
    setIsSyncing(true);
    try {
      await GameService.resetAllLocks();
      alert("鎖定已清除！");
    } catch (err) {
      console.error(err);
      alert("操作失敗。");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleResetProgress = async () => {
    if (!confirm("確定要重置所有人的進度嗎？這會讓這 100 張卡片全部變回未刮狀態（中獎號碼不變）。")) return;

    // 立即清空本地緩存
    clearLocalDone();

    const cleanDeck = deck.map(c => ({
      ...c,
      status: 'available' as const,
      isPlayed: false,
      isRevealed: false,
      progress: 0,
      lockedBy: undefined,
      lockedAt: undefined
    }));

    setIsSyncing(true);
    try {
      await GameService.saveGameToCloud(config, cleanDeck);
      setDeck(cleanDeck);
      alert("全域進度已重置！現在大家可以重新刮了。");
    } catch (err) {
      console.error(err);
      alert("重置失敗。");
    } finally {
      setIsSyncing(false);
    }
  };

  // Find the selected card object
  const selectedCard = mergedDeck.find(c => c.id === selectedCardId);

  // Stats Calculations (Reactive to BOTH isPlayed flag and status machine)
  const totalPrizePool = useMemo(() => mergedDeck.reduce((sum, card) => sum + card.totalPrizeAmount, 0), [mergedDeck]);

  const remainingPrizePool = useMemo(() =>
    mergedDeck
      .filter(c => !c.isPlayed && c.status !== 'completed')
      .reduce((sum, card) => sum + card.totalPrizeAmount, 0)
    , [mergedDeck]);

  const winningCardsRemaining = useMemo(() =>
    mergedDeck.filter(c => c.isWin && !c.isPlayed && c.status !== 'completed').length
    , [mergedDeck]);

  const totalWinningCards = useMemo(() => mergedDeck.filter(c => c.isWin).length, [mergedDeck]);

  const cumulativePrize = useMemo(() =>
    mergedDeck
      .filter(c => c.isPlayed || c.status === 'completed')
      .reduce((sum, card) => sum + card.totalPrizeAmount, 0)
    , [mergedDeck]);

  const winProbability = useMemo(() =>
    mergedDeck.length > 0 ? ((totalWinningCards / mergedDeck.length) * 100).toFixed(1) : "0.0"
    , [mergedDeck, totalWinningCards]);

  // Global Loading Protector
  if (authLoading || (cardsLoading && mergedDeck.length === 0)) {
    return (
      <div className="min-h-screen bg-[#FFF8F0] flex flex-col items-center justify-center font-sans">
        <motion.div
          animate={{ y: [0, -20, 0], scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 1 }}
          className="text-6xl mb-4"
        >
          🐱
        </motion.div>
        <p className="text-orange-500 font-black text-xl tracking-widest animate-pulse">
          LUCKY DATA LOADING...
        </p>
        <p className="text-gray-400 text-xs mt-2 font-bold">正在同步雲端資料，請稍候</p>
      </div>
    );
  }

  // Home Screen
  if (!selectedCard) {
    return (
      <div className="min-h-screen bg-[#FFF8F0] p-4 font-sans">
        {/* Header */}
        <header className="p-4 flex justify-between items-center relative z-10">
          <div className="flex items-center gap-2">
            <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm border border-white/30 shadow-inner">
              <Trophy className="text-yellow-300 drop-shadow-sm" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white italic tracking-tighter drop-shadow-md">
                <span className="text-yellow-300">LUCKY</span> SCRATCH
              </h1>
              <p className="text-[10px] text-white/80 font-bold tracking-widest uppercase -mt-1">
                WIN UP TO {Math.max(...config.tiers.map(t => t.amount)).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Music Toggle */}
            <button
              onClick={() => setIsMusicOn(!isMusicOn)}
              className="bg-white/20 p-2 rounded-full hover:bg-white/30 transition border border-white/30 backdrop-blur-md shadow-lg"
              title={isMusicOn ? '關閉音樂' : '開啟音樂'}
            >
              {isMusicOn ? (
                <Volume2 className="text-white" size={20} />
              ) : (
                <VolumeX className="text-white" size={20} />
              )}
            </button>

            {/* Only Admin can see Settings (hide in view-only mode) */}
            {isAdmin && !isViewOnly && (
              <button
                onClick={() => setShowSettings(true)}
                className="bg-white/20 p-2 rounded-full hover:bg-white/30 transition border border-white/30 backdrop-blur-md shadow-lg group"
              >
                <Settings className="text-white group-hover:rotate-45 transition-transform duration-500" size={24} />
              </button>
            )}

            {isViewOnly && (
              <div className="bg-blue-50/80 backdrop-blur-sm border border-blue-200 px-3 py-1.5 rounded-full text-[10px] font-black text-blue-700 shadow-sm">
                🔍 預覽模式
              </div>
            )}
          </div>
        </header>

        {/* Status Bar - 2x2 Grid Layout */}
        <div className="max-w-4xl mx-auto mb-6 grid grid-cols-2 gap-3">

          {/* Progress */}
          <div className="bg-white px-4 py-3 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Trophy size={14} className="text-gray-400" />
                <span className="text-xs text-gray-400 font-bold uppercase">已刮張數</span>
              </div>
              <span className="text-xl font-black text-gray-800">{playedIds.size} <span className="text-sm text-gray-400">/ {deck.length}</span></span>
            </div>
          </div>

          {/* Total Won */}
          <div className="bg-white px-4 py-3 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Coins size={14} className="text-green-500" />
                <span className="text-xs text-gray-400 font-bold uppercase">累積獎金</span>
              </div>
              <span className="text-xl font-black text-green-500">
                ${cumulativePrize.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Win Rate */}
          <div className="bg-white px-4 py-3 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Percent size={14} className="text-blue-400" />
                <span className="text-xs text-gray-400 font-bold uppercase">中獎機率</span>
              </div>
              <span className="text-xl font-black text-blue-500">{winProbability}%</span>
            </div>
          </div>

          {/* Remaining Pool */}
          <div className="bg-white px-4 py-3 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Trophy size={14} className="text-orange-400" />
                <span className="text-xs text-gray-400 font-bold uppercase">剩餘獎金</span>
              </div>
              <span className="text-xl font-black text-orange-500">${remainingPrizePool.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Grid */}
        <div className="max-w-4xl mx-auto pb-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {mergedDeck.map((card) => {
              const isPlayed = playedIds.has(card.id) || card.status === 'completed';
              // Important: only mark as locked by other if we KNOW who we are (uid is loaded)
              const isLockedByOther = !authLoading && !!uid && card.status === 'scratching' && card.lockedBy && card.lockedBy !== uid;
              const isLockedByMe = !authLoading && !!uid && card.status === 'scratching' && card.lockedBy === uid;
              const isUnavailable = isPlayed || isLockedByOther;

              return (
                <motion.button
                  key={card.id}
                  whileHover={isUnavailable ? {} : { scale: 1.03, y: -4 }}
                  whileTap={isUnavailable ? {} : { scale: 0.95 }}
                  onClick={() => {
                    if (isPlayed) {
                      setSelectedCardId(card.id);
                      return;
                    }
                    if (isLockedByOther) {
                      alert('這張卡正被其他人刮中，請選另一張！');
                      return;
                    }
                    handleSelectCard(card.id);
                  }}
                  className={`w-full aspect-[3/4.2] focus:outline-none rounded-2xl overflow-hidden shadow-md relative group bg-white ${isPlayed ? 'opacity-100' : ''} ${isLockedByOther ? 'opacity-50 cursor-not-allowed' : ''} ${isLockedByMe ? 'ring-4 ring-yellow-400 ring-inset' : ''}`}
                >
                  {/* If played, show result */}
                  {isPlayed ? (
                    <div className={`w-full h-full flex flex-col items-center justify-center border-4 ${card.isWin ? 'bg-yellow-50 border-yellow-400' : 'bg-gray-100 border-gray-300'}`}>
                      {card.isWin ? (
                        <>
                          <Trophy className="text-yellow-500 w-8 h-8 mb-2" />
                          <span className="text-green-600 font-black text-xl">${card.totalPrizeAmount}</span>
                        </>
                      ) : (
                        <>
                          <span className="text-3xl grayscale opacity-50">😿</span>
                          <span className="text-gray-400 font-bold mt-2">No Win</span>
                        </>
                      )}
                    </div>
                  ) : isLockedByOther ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-200 border-4 border-gray-300">
                      <span className="text-3xl">🔒</span>
                      <span className="text-gray-500 font-bold mt-2 text-xs">刮獎中...</span>
                    </div>
                  ) : (
                    <motion.div className="w-full h-full relative">
                      <img src={coverImage} alt="Cover" className="w-full h-full object-cover" />
                      {/* Phase 3: opacity fades as progress increases (other players' view) */}
                      {(card.status === 'scratching' || isLockedByMe) && (card.progress ?? 0) > 0 && (
                        <motion.div
                          className="absolute inset-0 bg-white"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: Math.min(0.8, (card.progress ?? 0) / 100) }}
                          transition={{ duration: 0.5 }}
                        />
                      )}
                      {isLockedByMe && (
                        <div className="absolute inset-x-0 bottom-0 bg-yellow-400 text-yellow-900 text-[10px] font-black py-1 text-center">
                          您正在刮這張
                        </div>
                      )}
                    </motion.div>
                  )}

                  <div className="absolute top-2 right-2 bg-white/90 backdrop-blur text-gray-800 text-xs font-bold px-2 py-1 rounded-md shadow-sm z-10">
                    #{card.id}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>

        <SettingsPanel
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          config={config}
          setConfig={setConfig}
          onRegenerate={regenerateDeckHandler}
          onSave={handleSaveToCloud}
          onShare={handleShare}
          isSyncing={isSyncing}
          onUploadCover={handleUploadCover}
          currentCover={coverImage}
          onShareSnapshot={handleShareCloudLink}
          onResetLocks={handleResetLocks}
          onResetProgress={handleResetProgress}
        />
      </div>
    );
  }

  // --- Phase 3: Progress update handler ---
  // --- Phase 3: Progress update handler (Throttled to max 1 update per 1.5s) ---
  const lastProgressRef = useRef<{ [id: number]: number }>({});
  const lastUpdateRef = useRef<{ [id: number]: number }>({});

  const handleProgressUpdate = async (percentage: number) => {
    if (!selectedCard) return;

    const now = Date.now();
    const lastTime = lastUpdateRef.current[selectedCard.id] || 0;
    const lastVal = lastProgressRef.current[selectedCard.id] || 0;

    // Only skip if it's too frequent AND the change is small (<5%)
    // But always send if it's been more than 1.5s
    if (now - lastTime < 1500 && Math.abs(percentage - lastVal) < 5) {
      return;
    }

    lastUpdateRef.current[selectedCard.id] = now;
    lastProgressRef.current[selectedCard.id] = percentage;

    try {
      await GameService.updateCardProgress(selectedCard.id, percentage);
    } catch (err) {
      console.error('Failed to update progress (likely concurrent edit):', err);
    }
  };

  // Game Screen
  return (
    <ScratchCardGame
      cardData={selectedCard}
      coverImage={coverImage}
      winMessage={config.winMessage}
      loseMessage={config.loseMessage}
      onBack={() => setSelectedCardId(null)}
      onComplete={() => handleCardComplete(selectedCard.id)}
      onProgressUpdate={handleProgressUpdate}
      revealThreshold={REVEAL_THRESHOLD}
    />
  );
};

export default App;