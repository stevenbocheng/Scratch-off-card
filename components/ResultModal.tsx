import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Home, XCircle, CheckCircle2, Eye, LayoutGrid } from 'lucide-react';
import { GameResult } from '../types';

interface ResultModalProps {
  isOpen: boolean;
  result: GameResult;
  onBackToList: () => void;
  onViewCard: () => void;
  winMessage: string;
  loseMessage: string;
}

const ResultModal: React.FC<ResultModalProps> = ({ 
  isOpen, 
  result, 
  onBackToList, 
  onViewCard,
  winMessage,
  loseMessage
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ scale: 0.8, y: 50, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.8, y: 50, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl text-center relative overflow-hidden"
          >
            {/* Background Decor */}
            <div className={`absolute top-0 left-0 w-full h-32 rounded-b-[50%] -translate-y-16 -z-0 opacity-20 ${result.isWin ? 'bg-yellow-400' : 'bg-gray-400'}`}></div>

            <div className="relative z-10">
              {result.isWin ? (
                <>
                  <div className="mx-auto w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-3 text-yellow-500 shadow-inner">
                    <Trophy size={32} />
                  </div>
                  <h2 className="text-3xl font-black text-gray-800 mb-1">{winMessage}</h2>
                  <p className="text-gray-500 mb-4 text-sm">獲得獎金:</p>
                  
                  <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-4 mb-4">
                    <span className="text-5xl font-black text-yellow-500 drop-shadow-sm">${result.totalPrizeAmount}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3 text-gray-400">
                    <span className="text-3xl">🐱</span>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-1">{loseMessage}</h2>
                  <p className="text-gray-500 mb-4 text-sm">再接再厲！</p>
                </>
              )}

              {/* Game Summary */}
              <div className="space-y-2 mb-6 text-left bg-gray-50 p-3 rounded-xl">
                {result.games.map((game, idx) => (
                    <div key={idx} className="flex items-center justify-between mb-2 last:mb-0 border-b border-gray-100 pb-1 last:border-0">
                        <span className="text-xs font-bold text-gray-400 uppercase w-12">第 {idx+1} 局</span>
                        <div className="flex items-center gap-2 flex-1 justify-center">
                             {/* Left: House, Right: My */}
                             <span className="text-sm text-gray-600 font-bold">{game.house}</span>
                             <span className="text-xs text-gray-400">vs</span>
                             <span className="text-sm text-gray-600 font-bold">{game.my}</span>
                        </div>
                        {game.isWin ? <CheckCircle2 size={16} className="text-green-500"/> : <XCircle size={16} className="text-gray-300"/>}
                    </div>
                ))}
                
                {/* Bonus Status */}
                <div className="flex items-center justify-between pt-1">
                     <span className="text-xs font-bold text-gray-400 uppercase w-12">幸運區</span>
                     <span className="text-xs text-gray-500 font-bold">{result.isBonusWin ? `贏得 $${result.bonusPrize}` : '未中獎'}</span>
                     {result.isBonusWin ? <CheckCircle2 size={16} className="text-green-500"/> : <XCircle size={16} className="text-gray-300"/>}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={onViewCard}
                    className="w-full bg-gray-100 text-gray-600 font-bold py-3 rounded-xl shadow-sm hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                  >
                    <Eye size={18} />
                    檢視卡片
                  </button>
                  <button
                    onClick={onBackToList}
                    className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-bold py-3 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                  >
                    <LayoutGrid size={18} />
                    返回列表
                  </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ResultModal;