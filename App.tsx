import React, { useState, useEffect, useRef } from 'react';
import { Settings, X, Cat, Trophy, RotateCcw, Upload, Image as ImageIcon, Plus, Trash2, Percent, Coins, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ScratchCanvas from './components/ScratchCanvas';
import ResultModal from './components/ResultModal';
import { generateDeck, SoundManager, triggerHaptic } from './utils';
import { GameConfig, GameResult } from './types';

// --- Default Configuration ---
const DEFAULT_CONFIG: GameConfig = {
  totalCards: 100,
  tiers: [
      { count: 1, amount: 5000 },  // Jackpot
      { count: 5, amount: 500 },   // Big
      { count: 15, amount: 50 },   // Medium
      { count: 30, amount: 10 },   // Small
  ],
  winMessage: "恭喜中獎!",
  loseMessage: "沒中獎..."
};

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
}> = ({ isOpen, onClose, config, setConfig, onRegenerate, onUploadCover, currentCover }) => {
  
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
                      <ImageIcon size={18} className="text-purple-500"/> 卡片外觀 (Appearance)
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
                            onChange={(e) => setConfig({...config, winMessage: e.target.value})}
                            className="w-full border rounded-lg px-3 py-2 text-sm font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                            placeholder="恭喜中獎!"
                          />
                      </div>
                      <div>
                          <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">未中獎文字 (Lose Message)</label>
                          <input 
                            type="text" 
                            value={config.loseMessage}
                            onChange={(e) => setConfig({...config, loseMessage: e.target.value})}
                            className="w-full border rounded-lg px-3 py-2 text-sm font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                            placeholder="沒中獎..."
                          />
                      </div>
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
                        <Plus size={12}/> 新增獎項
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

              <button 
                onClick={() => { onRegenerate(); onClose(); }} 
                className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transform active:scale-95 transition flex items-center justify-center gap-2"
              >
                  <RotateCcw size={20} />
                  重新產生牌組 (Regenerate)
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
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
                 <span className="text-xs font-black text-gray-500/80 tracking-tighter -mt-1 scale-y-90">
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
  onComplete: () => void;
}> = ({ cardData, coverImage, winMessage, loseMessage, onBack, onComplete }) => {
  // If card is already played, start as revealed
  const isAlreadyPlayed = cardData.isPlayed;
  const [isRevealed, setIsRevealed] = useState(isAlreadyPlayed);
  const [showModal, setShowModal] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateSize = () => {
        if(containerRef.current) {
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
      SOUND_MANAGER.stopScratch();
      onComplete();

      setTimeout(() => {
        if (cardData.isWin) {
            SOUND_MANAGER.playWin();
        }
        setShowModal(true);
      }, 1000);
    }
  };

  // Allow closing if revealed OR if it was already played before entering
  const canClose = isRevealed || isAlreadyPlayed;

  return (
    <div className="min-h-screen bg-[#FFF8F0] flex flex-col items-center pt-6 pb-4 px-4 relative overflow-hidden">
      {/* Navbar */}
      <div className="w-full max-w-md flex justify-between items-center mb-4 z-10">
        <button 
          onClick={onBack}
          disabled={!canClose}
          className={`p-3 bg-white rounded-full shadow-md transition border border-gray-100 ${
            canClose 
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
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(45deg, #ffffff 25%, transparent 25%, transparent 50%, #ffffff 50%, #ffffff 75%, transparent 75%, transparent)', backgroundSize: '10px 10px'}}></div>
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
                <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, #ffffff 10px, #ffffff 20px)'}}></div>
                
                <span className="text-sm font-bold text-purple-200 tracking-widest mb-2 z-10 bg-purple-900/50 px-3 py-1 rounded-full border border-purple-400/30">
                    幸運獎金區 (BONUS)
                </span>
                
                <div className="z-10 flex items-baseline relative">
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
                    isRevealed={isRevealed}
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
  const [config, setConfig] = useState<GameConfig>(DEFAULT_CONFIG);
  const [deck, setDeck] = useState<GameResult[]>([]);
  const [playedIds, setPlayedIds] = useState<Set<number>>(new Set());
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [coverImage, setCoverImage] = useState<string>(DEFAULT_COVER);

  // Initialize Deck
  useEffect(() => {
    setDeck(generateDeck(config));
    setPlayedIds(new Set()); // Reset played on regenerate
  }, [config]);

  const handleCardComplete = (id: number) => {
    setDeck(prevDeck => prevDeck.map(card => 
        card.id === id ? { ...card, isPlayed: true } : card
    ));
    setPlayedIds(prev => new Set(prev).add(id));
  };

  const regenerateDeckHandler = () => {
     setDeck(generateDeck(config));
     setPlayedIds(new Set());
  };

  const handleUploadCover = (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
          if (e.target?.result) {
              setCoverImage(e.target.result as string);
          }
      };
      reader.readAsDataURL(file);
  };

  // Find the selected card object
  const selectedCard = deck.find(c => c.id === selectedCardId);

  // Stats Calculations
  const totalPrizePool = deck.reduce((sum, card) => sum + card.totalPrizeAmount, 0);
  const totalWinningCards = deck.filter(c => c.isWin).length;
  const winProbability = deck.length > 0 ? ((totalWinningCards / deck.length) * 100).toFixed(1) : "0.0";

  // Home Screen
  if (!selectedCard) {
    return (
      <div className="min-h-screen bg-[#FFF8F0] p-4 font-sans">
        {/* Header */}
        <header className="flex justify-between items-center mb-6 pt-2 max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="bg-yellow-400 p-2 rounded-xl shadow-lg border-2 border-yellow-500">
                <Cat className="text-white w-6 h-6" />
            </div>
            <div>
                <h1 className="text-2xl font-black text-gray-800 tracking-tight leading-none">Lucky Paws</h1>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Scratch Collection</p>
            </div>
          </div>
          <button 
            onClick={() => setShowSettings(true)}
            className="p-2 bg-white rounded-xl shadow-sm hover:shadow-md transition text-gray-400 hover:text-orange-400 border border-gray-100"
          >
            <Settings size={22} />
          </button>
        </header>

        {/* Status Bar - 2x2 Grid Layout */}
        <div className="max-w-4xl mx-auto mb-6 grid grid-cols-2 gap-3">
            
            {/* Progress */}
            <div className="bg-white px-4 py-3 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                      <Trophy size={14} className="text-gray-400"/>
                      <span className="text-xs text-gray-400 font-bold uppercase">已刮張數</span>
                  </div>
                  <span className="text-xl font-black text-gray-800">{playedIds.size} <span className="text-sm text-gray-400">/ {deck.length}</span></span>
                </div>
            </div>

            {/* Total Won */}
            <div className="bg-white px-4 py-3 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                      <Coins size={14} className="text-green-500"/>
                      <span className="text-xs text-gray-400 font-bold uppercase">累積獎金</span>
                  </div>
                  <span className="text-xl font-black text-green-500">
                      ${Array.from(playedIds).reduce((sum, id) => {
                          const card = deck.find(c => c.id === id);
                          return sum + (card?.totalPrizeAmount || 0);
                      }, 0).toLocaleString()}
                  </span>
                </div>
            </div>

            {/* Win Rate */}
            <div className="bg-white px-4 py-3 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                      <Percent size={14} className="text-blue-400"/>
                      <span className="text-xs text-gray-400 font-bold uppercase">中獎機率</span>
                  </div>
                  <span className="text-xl font-black text-blue-500">{winProbability}%</span>
                </div>
            </div>

             {/* Total Pool */}
             <div className="bg-white px-4 py-3 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                      <Trophy size={14} className="text-orange-400"/>
                      <span className="text-xs text-gray-400 font-bold uppercase">總獎金池</span>
                  </div>
                  <span className="text-xl font-black text-orange-500">${totalPrizePool.toLocaleString()}</span>
                </div>
            </div>
        </div>

        {/* Grid */}
        <div className="max-w-4xl mx-auto pb-8">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {deck.map((card) => {
                const isPlayed = playedIds.has(card.id);
                return (
                    <motion.button
                        key={card.id}
                        whileHover={{ scale: 1.03, y: -4 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setSelectedCardId(card.id)}
                        className={`w-full aspect-[3/4.2] focus:outline-none rounded-2xl overflow-hidden shadow-md relative group bg-white ${isPlayed ? 'opacity-100' : ''}`}
                    >
                        {/* If played, show result summary but allow re-entry */}
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
                        ) : (
                            <img src={coverImage} alt="Cover" className="w-full h-full object-cover" />
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
            onUploadCover={handleUploadCover}
            currentCover={coverImage}
        />
      </div>
    );
  }

  // Game Screen
  return (
    <ScratchCardGame 
      cardData={selectedCard}
      coverImage={coverImage}
      winMessage={config.winMessage}
      loseMessage={config.loseMessage}
      onBack={() => setSelectedCardId(null)}
      onComplete={() => handleCardComplete(selectedCard.id)}
    />
  );
};

export default App;