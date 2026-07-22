/**
 * GameUI - UI overlay management for training game
 */

import type { GameScore } from './GameState'

export class GameUI {
  /**
   * Update score display
   */
  static updateScore(score: GameScore): void {
    const scoreElement = document.getElementById('game-score')
    if (scoreElement) {
      scoreElement.textContent = score.totalScore.toString()
    }
  }

  /**
   * Update level display
   */
  static updateLevel(level: number): void {
    const levelElement = document.getElementById('game-level')
    if (levelElement) {
      levelElement.textContent = level.toString()
    }
  }

  /**
   * Update shapes remaining counter
   */
  static updateShapesRemaining(remaining: number): void {
    const remainingElement = document.getElementById('game-remaining')
    if (remainingElement) {
      remainingElement.textContent = remaining.toString()
    }
  }

  /**
   * Show level start message
   */
  static showLevelStart(level: number): void {
    const messageElement = document.getElementById('game-message')
    const messageText = document.getElementById('game-message-text')

    if (messageElement && messageText) {
      messageText.textContent = `Level ${level}`
      messageElement.style.display = 'flex'

      // Hide after 2 seconds
      setTimeout(() => {
        messageElement.style.display = 'none'
      }, 2000)
    }
  }

  /**
   * Show level complete message
   */
  static showLevelComplete(score: number, timeBonus: number): void {
    const messageElement = document.getElementById('game-message')
    const messageText = document.getElementById('game-message-text')

    if (messageElement && messageText) {
      let message = 'Level Complete!'
      if (timeBonus > 0) {
        message += `\n+${timeBonus} time bonus`
      }
      messageText.textContent = message
      messageElement.style.display = 'flex'

      // Hide after 1.5 seconds (before next level loads)
      setTimeout(() => {
        messageElement.style.display = 'none'
      }, 1500)
    }
  }

  /**
   * Show game complete message
   */
  static showGameComplete(finalScore: number): void {
    const messageElement = document.getElementById('game-message')
    const messageText = document.getElementById('game-message-text')

    if (messageElement && messageText) {
      messageText.textContent = `Game Complete!\nFinal Score: ${finalScore}`
      messageElement.style.display = 'flex'
    }
  }

  /**
   * Show game HUD
   */
  static showGameHUD(): void {
    const hudElement = document.getElementById('game-hud')
    if (hudElement) {
      hudElement.style.display = 'flex'
    }
  }

  /**
   * Hide game HUD
   */
  static hideGameHUD(): void {
    const hudElement = document.getElementById('game-hud')
    if (hudElement) {
      hudElement.style.display = 'none'
    }

    // Also hide message
    const messageElement = document.getElementById('game-message')
    if (messageElement) {
      messageElement.style.display = 'none'
    }
  }

  /**
   * Set button state (show/hide, enable/disable)
   */
  static setButtonState(
    button: 'start' | 'pause' | 'restart',
    visible: boolean
  ): void {
    const buttonId = `game-${button}`
    const buttonElement = document.getElementById(buttonId)
    if (buttonElement) {
      buttonElement.style.display = visible ? 'block' : 'none'
    }
  }

  /**
   * Update pause button text
   */
  static updatePauseButtonText(paused: boolean): void {
    const pauseButton = document.getElementById('game-pause')
    if (pauseButton) {
      pauseButton.textContent = paused ? 'Resume' : 'Pause'
    }
  }
}
