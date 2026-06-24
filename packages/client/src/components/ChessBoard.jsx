/**
 * Created by lyy on 2017/12/19.
 */
import React, { Component } from 'react'
import { ActionCreators as UndoActionCreators } from 'redux-undo'
import UndoRedo from '../container/UndoRedo'
import addChessCreator from '../redux/actions/addChess'
import resetGameCreator from '../redux/actions/resetGame'
import wsService from '../services/websocket'
import { GRID_COUNT, checkWin } from '@gobang/shared'

// AI 评分权重
const SCORE = {
  WIN: 1000000,
  LIVE_FOUR: 100000,
  DEAD_FOUR: 10000,
  LIVE_THREE: 5000,
  DEAD_THREE: 1000,
  LIVE_TWO: 200,
  DEAD_TWO: 50,
  LIVE_ONE: 10
}

// AI 难度配置：searchRange 越大看得越远，defenseWeight 越大越偏防守
const DIFFICULTY = {
  easy: { searchRange: 1, defenseWeight: 0.6, label: '简单' },
  medium: { searchRange: 2, defenseWeight: 0.9, label: '中等' },
  hard: { searchRange: 3, defenseWeight: 1.1, label: '困难' }
}

export default class ChessBoard extends Component {
  constructor(props) {
    super(props);
    this.canvasRef = React.createRef()
    this.aiTimer = null
    this.state = {
      gameOver: false,
      winner: null,
      vsAI: props.localMode === 'pve',
      aiThinking: false,
      difficulty: 'medium'
    }
    this.drawChessBoard = this.drawChessBoard.bind(this)
    this.oneStep = this.oneStep.bind(this)
    this.handleResize = this.handleResize.bind(this)
    this.redrawAll = this.redrawAll.bind(this)
    this.doAIMove = this.doAIMove.bind(this)
    this.switchMode = this.switchMode.bind(this)
    this.resetGame = this.resetGame.bind(this)
  }

  componentDidMount() {
    // 先反推最后一手，再绘制（handleResize 内会调 redrawAll）
    this.initLastMove()
    this.handleResize()
    window.addEventListener('resize', this.handleResize)
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.handleResize)
    if (this.aiTimer) clearTimeout(this.aiTimer)
  }

  // 切换对战模式
  switchMode(vsAI) {
    // Cannot switch modes in online mode
    if (this.props.onlineMode) return
    this.setState({ vsAI, gameOver: false, winner: null, aiThinking: false })
    if (this.aiTimer) clearTimeout(this.aiTimer)
    // 切换后人机模式，AI（黑棋）先手
    if (vsAI) {
      setTimeout(() => this.doAIMove(), 500)
    }
  }

  // 重新开局
  resetGame() {
    if (this.aiTimer) clearTimeout(this.aiTimer)

    if (this.props.onlineMode) {
      wsService.send({ type: 'reset_game' })
      return
    }

    this.props.dispatch(resetGameCreator())
    this.setState({ gameOver: false, winner: null, aiThinking: false })
    this.lastMove = null
    // 等 Redux 更新后重绘，人机模式触发 AI 先手
    setTimeout(() => {
      this.redrawAll()
      if (this.state.vsAI) {
        this.doAIMove()
      }
    }, 0)
  }

  // 悔棋：人机模式下自动撤销两步（人类 + AI）
  handleUndo = () => {
    if (this.props.onlineMode) return // No undo in online mode
    this.lastMove = null
    if (this.state.gameOver) {
      this.setState({ gameOver: false, winner: null })
    }
    this.props.dispatch(UndoActionCreators.undo())
    if (this.state.vsAI) {
      setTimeout(() => this.props.dispatch(UndoActionCreators.undo()), 0)
    }
  }

  // 初始加载/重连时，根据当前轮到谁反推最后落子位置
  initLastMove() {
    const container = this.getContainer()
    if (!container) return
    const totalPieces = container.black.length + container.white.length
    if (totalPieces === 0) return

    // 当前轮到谁走，上一手就是对方走的；取对方棋子数组最后一个
    const currentPlayer = this.getPlayer()
    const lastPlayer = currentPlayer === 'black' ? 'white' : 'black'
    const lastPlayerPieces = container[lastPlayer]
    if (lastPlayerPieces && lastPlayerPieces.length > 0) {
      const lastPlaced = lastPlayerPieces[lastPlayerPieces.length - 1]
      this.lastMove = { x: lastPlaced[0], y: lastPlaced[1] }
    }
  }

  // Get container data: from online state or local redux
  getContainer() {
    if (this.props.onlineMode && this.props.onlineGameState) {
      return this.props.onlineGameState.container
    }
    return this.props.golang.present.container
  }

  getPlayer() {
    if (this.props.onlineMode && this.props.onlineGameState) {
      return this.props.onlineGameState.player
    }
    return this.props.golang.present.player
  }

  isGameOver() {
    if (this.props.onlineMode && this.props.onlineGameState) {
      return this.props.onlineGameState.gameOver
    }
    return this.state.gameOver
  }

  getWinner() {
    if (this.props.onlineMode && this.props.onlineGameState) {
      return this.props.onlineGameState.winner
    }
    return this.state.winner
  }

  // 计算棋盘尺寸，设置 canvas 分辨率
  handleResize() {
    const canvas = this.canvasRef.current
    if (!canvas) return
    const parent = canvas.parentElement
    const maxSize = Math.min(parent.clientWidth - 20, 600)
    const dpr = window.devicePixelRatio || 1

    canvas.width = maxSize * dpr
    canvas.height = maxSize * dpr
    canvas.style.width = maxSize + 'px'
    canvas.style.height = maxSize + 'px'

    this.cellSize = maxSize / (GRID_COUNT + 1)
    this.padding = this.cellSize

    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)

    this.redrawAll()
  }

  // 重绘整个棋盘和棋子
  redrawAll(container) {
    const canvas = this.canvasRef.current
    if (!canvas) return
    this.drawChessBoard()
    const c = container || this.getContainer()
    if (!c) return
    c.black.forEach(i => this.drawChess(i[0], i[1], 'black'))
    c.white.forEach(i => this.drawChess(i[0], i[1], 'white'))
    // 绘制最后落子标识
    if (this.lastMove) {
      this.drawLastMoveIndicator()
    }
  }

  // 最后落子标识（红色小圆点）
  drawLastMoveIndicator() {
    const canvas = this.canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const { x, y } = this.lastMove
    const cx = this.padding + x * this.cellSize
    const cy = this.padding + y * this.cellSize

    ctx.save()
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.beginPath()
    ctx.arc(cx, cy, this.cellSize * 0.13, 0, 2 * Math.PI)
    ctx.fillStyle = '#e53935'
    ctx.fill()
    ctx.restore()
  }

  // 检查某个位置是否已有棋子
  hasChessAt(x, y, container) {
    const c = container || this.getContainer()
    if (!c) return false
    return c.black.some(p => p[0] === x && p[1] === y) ||
      c.white.some(p => p[0] === x && p[1] === y)
  }

  hasChess(position) {
    return this.hasChessAt(position[0], position[1])
  }

  // ===================== AI 相关方法 =====================

  // 获取候选位置（已有棋子周围 n 格范围内的空位）
  getCandidates(container, n = 1) {
    const c = container || this.getContainer()
    if (!c) return [[7, 7]]
    const { black, white } = c
    const allPieces = [...black, ...white]
    if (allPieces.length === 0) {
      return [[7, 7]] // 天元开局
    }
    const candidateSet = new Set()
    for (const [px, py] of allPieces) {
      for (let dx = -1 * n; dx <= n; dx++) {
        for (let dy = -1 * n; dy <= n; dy++) {
          const nx = px + dx
          const ny = py + dy
          if (nx >= 0 && nx < GRID_COUNT && ny >= 0 && ny < GRID_COUNT &&
            !this.hasChessAt(nx, ny, container)) {
            candidateSet.add(nx * GRID_COUNT + ny)
          }
        }
      }
    }
    return [...candidateSet].map(v => [Math.floor(v / GRID_COUNT), v % GRID_COUNT])
  }

  // 沿某个方向数连续棋子
  countDirection(x, y, dx, dy, player, container) {
    const pieces = container[player]
    let count = 0
    let openEnds = 0

    // 正方向
    for (let i = 1; i <= 5; i++) {
      const nx = x + dx * i
      const ny = y + dy * i
      if (pieces.some(p => p[0] === nx && p[1] === ny)) {
        count++
      } else {
        if (nx >= 0 && nx < GRID_COUNT && ny >= 0 && ny < GRID_COUNT &&
          !this.hasChessAt(nx, ny, container)) {
          openEnds++
        }
        break
      }
    }
    // 反方向
    for (let i = 1; i <= 5; i++) {
      const nx = x - dx * i
      const ny = y - dy * i
      if (pieces.some(p => p[0] === nx && p[1] === ny)) {
        count++
      } else {
        if (nx >= 0 && nx < GRID_COUNT && ny >= 0 && ny < GRID_COUNT &&
          !this.hasChessAt(nx, ny, container)) {
          openEnds++
        }
        break
      }
    }
    return { count, openEnds }
  }

  // 评估某个位置对指定玩家的价值
  evaluatePosition(x, y, player, container) {
    const directions = [[1, 0], [0, 1], [1, 1], [1, -1]]
    let totalScore = 0

    for (const [dx, dy] of directions) {
      const { count, openEnds } = this.countDirection(x, y, dx, dy, player, container)
      if (count >= 4) {
        totalScore += SCORE.WIN
      } else if (count === 3) {
        totalScore += openEnds === 2 ? SCORE.LIVE_FOUR : SCORE.DEAD_FOUR
      } else if (count === 2) {
        totalScore += openEnds === 2 ? SCORE.LIVE_THREE : SCORE.DEAD_THREE
      } else if (count === 1) {
        totalScore += openEnds === 2 ? SCORE.LIVE_TWO : SCORE.DEAD_TWO
      } else {
        totalScore += openEnds === 2 ? SCORE.LIVE_ONE : 0
      }
    }
    return totalScore
  }

  // 获取 AI 最佳落子位置
  getBestMove(container) {
    const aiPlayer = 'black'
    const humanPlayer = 'white'
    const { searchRange, defenseWeight } = DIFFICULTY[this.state.difficulty]
    const candidates = this.getCandidates(container, searchRange)

    let bestScore = -Infinity
    let bestMove = candidates[0]

    for (const [x, y] of candidates) {
      const aiScore = this.evaluatePosition(x, y, aiPlayer, container)
      const humanScore = this.evaluatePosition(x, y, humanPlayer, container)

      // 必须堵住人类即将五连的位置
      if (humanScore >= SCORE.WIN) {
        return [x, y]
      }

      // AI 自己可以赢，直接下
      if (aiScore >= SCORE.WIN) {
        return [x, y]
      }

      // 综合评分：攻守兼备，权重随难度调整
      const totalScore = aiScore + humanScore * defenseWeight

      if (totalScore > bestScore) {
        bestScore = totalScore
        bestMove = [x, y]
      }
    }
    return bestMove
  }

  // 执行 AI 落子
  doAIMove() {
    if (!this.state.vsAI || this.state.gameOver || this.state.aiThinking) return

    const container = this.getContainer()
    const totalPieces = container.black.length + container.white.length

    // 空棋盘时 AI 执黑先手，不受 player 状态限制
    if (totalPieces === 0) {
      this.setState({ aiThinking: true })
      this.aiTimer = setTimeout(() => {
        const [x, y] = this.getBestMove(container)
        this.lastMove = { x, y, player: 'black' }
        this.props.dispatch(addChessCreator([x, y], 'black'))
        this.setState({ aiThinking: false })
      }, 400)
      return
    }

    const player = this.getPlayer()
    if (player !== 'black') return // AI 只走黑棋

    this.setState({ aiThinking: true })

    this.aiTimer = setTimeout(() => {
      const [x, y] = this.getBestMove(container)

      // 记录最后落子位置
      this.lastMove = { x, y, player: 'black' }

      // 检查是否获胜
      if (this.checkWinAfterPlace(x, y, 'black', container)) {
        this.setState({ gameOver: true, winner: 'black', aiThinking: false })
      } else {
        this.setState({ aiThinking: false })
      }

      this.props.dispatch(addChessCreator([x, y], 'black'))
    }, 400) // 400ms 延迟，模拟思考
  }

  // ===================== 游戏逻辑 =====================

  drawChessBoard() {
    const canvas = this.canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const cssWidth = canvas.style.width ? parseFloat(canvas.style.width) : canvas.width / dpr
    const cssHeight = canvas.style.height ? parseFloat(canvas.style.height) : canvas.height / dpr

    ctx.save()
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, cssWidth, cssHeight)

    // 棋盘背景
    ctx.fillStyle = '#e8c97a'
    ctx.fillRect(0, 0, cssWidth, cssHeight)

    // 网格线
    ctx.strokeStyle = '#5a4a2a'
    ctx.lineWidth = 1
    for (let i = 0; i < GRID_COUNT; i++) {
      const pos = this.padding + i * this.cellSize
      ctx.beginPath()
      ctx.moveTo(this.padding, pos)
      ctx.lineTo(this.padding + (GRID_COUNT - 1) * this.cellSize, pos)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(pos, this.padding)
      ctx.lineTo(pos, this.padding + (GRID_COUNT - 1) * this.cellSize)
      ctx.stroke()
    }

    // 星位点
    const starPoints = [
      [3, 3], [3, 7], [3, 11],
      [7, 3], [7, 7], [7, 11],
      [11, 3], [11, 7], [11, 11]
    ]
    ctx.fillStyle = '#5a4a2a'
    starPoints.forEach(([cx, cy]) => {
      ctx.beginPath()
      ctx.arc(this.padding + cx * this.cellSize, this.padding + cy * this.cellSize, 3, 0, 2 * Math.PI)
      ctx.fill()
    })

    ctx.restore()
  }

  oneStep(e) {
    if (this.isGameOver()) return

    const container = this.getContainer()
    if (this.props.onlineMode) {
      // Online mode: check if it's this player's turn and opponent is connected
      if (!this.props.gameStarted) return
      if (!this.props.opponentConnected) return
      if (this.state.aiThinking) return
      if (!this.props.onlineGameState) return

      const currentPlayer = this.props.onlineGameState.player
      if (currentPlayer !== this.props.myPlayer) return
    } else {
      if (this.state.aiThinking) return

      const player = this.getPlayer()
      // 人机模式：人类只能走白棋
      if (this.state.vsAI && player !== 'white') return
    }

    const dpr = window.devicePixelRatio || 1
    const offsetX = e.nativeEvent.offsetX / dpr
    const offsetY = e.nativeEvent.offsetY / dpr

    const x = Math.round((offsetX - this.padding) / this.cellSize)
    const y = Math.round((offsetY - this.padding) / this.cellSize)

    if (x < 0 || x >= GRID_COUNT || y < 0 || y >= GRID_COUNT) return
    if (this.hasChessAt(x, y, container)) return

    // 记录最后落子位置
    const player = this.getPlayer()
    this.lastMove = { x, y, player }

    if (this.props.onlineMode) {
      // Send move via WebSocket
      wsService.send({ type: 'make_move', position: [x, y] })
    } else {
      const won = this.checkWinAfterPlace(x, y, player, container)
      if (won) {
        this.setState({ gameOver: true, winner: player })
      }

      this.props.dispatch(addChessCreator([x, y], player))

      // 人机模式：人类落子后触发 AI
      if (this.state.vsAI && !won) {
        setTimeout(() => this.doAIMove(), 300)
      }
    }
  }

  checkWinAfterPlace(x, y, player, container) {
    return checkWin(x, y, player, container[player])
  }

  drawChess(x, y, player) {
    const canvas = this.canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const centerX = this.padding + x * this.cellSize
    const centerY = this.padding + y * this.cellSize
    const radius = this.cellSize * 0.43

    ctx.save()
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.beginPath()
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI)
    ctx.closePath()

    const gradient = ctx.createRadialGradient(
      centerX + radius * 0.15, centerY - radius * 0.15, radius,
      centerX + radius * 0.15, centerY - radius * 0.15, 0
    )
    if (player === 'black') {
      gradient.addColorStop(0, '#0a0a0a')
      gradient.addColorStop(1, '#636766')
    } else {
      gradient.addColorStop(0, '#d1d1d1')
      gradient.addColorStop(1, '#f9f9f9')
    }
    ctx.fillStyle = gradient
    ctx.fill()
    ctx.restore()
  }

  componentWillReceiveProps(nextProps) {
    // For online mode, check if onlineGameState changed
    if (nextProps.onlineMode && nextProps.onlineGameState) {
      if (nextProps.onlineGameState !== this.props.onlineGameState) {
        const container = nextProps.onlineGameState.container
        if (container) {
          const prevContainer = this.props.onlineGameState ? this.props.onlineGameState.container : null
          if (prevContainer) {
            const totalPrev = prevContainer.black.length + prevContainer.white.length
            const totalNext = container.black.length + container.white.length
            if (totalNext > totalPrev) {
              // Find the last piece placed
              const diffBlack = container.black.filter(p =>
                !prevContainer.black.some(b => b[0] === p[0] && b[1] === p[1])
              )
              const diffWhite = container.white.filter(p =>
                !prevContainer.white.some(w => w[0] === p[0] && w[1] === p[1])
              )
              const diff = [...diffBlack, ...diffWhite]
              if (diff.length > 0) {
                const lastPlaced = diff[diff.length - 1]
                this.lastMove = { x: lastPlaced[0], y: lastPlaced[1] }
              }
            }
          } else {
            // First load / reconnect: determine last move from gameState
            // The player who just moved is the opposite of current player
            const currentPlayer = nextProps.onlineGameState.player
            const lastPlayer = currentPlayer === 'black' ? 'white' : 'black'
            const lastPlayerPieces = container[lastPlayer]
            if (lastPlayerPieces && lastPlayerPieces.length > 0) {
              const lastPlaced = lastPlayerPieces[lastPlayerPieces.length - 1]
              this.lastMove = { x: lastPlaced[0], y: lastPlaced[1] }
            }
          }
          this.redrawAll(container)
        }
      }
      return
    }

    // Local mode: check if redux container changed
    const prevContainer = this.props.golang.present.container
    const nextContainer = nextProps.golang.present.container

    if (nextContainer !== prevContainer) {
      this.redrawAll(nextContainer)
    }
  }

  render() {
    const gameOver = this.isGameOver()
    const winner = this.getWinner()
    const currentPlayer = this.getPlayer()
    const playerText = currentPlayer === 'black' ? '黑棋' : '白棋'
    const { vsAI, aiThinking } = this.state
    const { onlineMode, myPlayer, roomId, gameStarted, opponentConnected } = this.props

    let statusText
    if (gameOver) {
      const winnerText = winner === 'black' ? '黑棋' : '白棋'
      statusText = `${winnerText}获胜！`
    } else if (onlineMode) {
      if (!gameStarted) {
        statusText = opponentConnected ? '对手已加入，开始对局！' : '等待对手加入...'
      } else {
        if (currentPlayer === myPlayer) {
          statusText = `轮到你走棋（${playerText}）`
        } else {
          statusText = `等待对手走棋...（${playerText === '黑棋' ? '白棋' : '黑棋'}）`
        }
      }
    } else if (aiThinking) {
      statusText = 'AI 思考中...'
    } else {
      statusText = `当前落子方：${playerText}`
    }

    // Determine if canvas should be clickable
    let clickable = true
    if (gameOver) clickable = false
    if (!onlineMode && aiThinking) clickable = false
    if (onlineMode) {
      if (!gameStarted || !opponentConnected) clickable = false
      if (currentPlayer !== myPlayer) clickable = false
    }

    return (
      <div style={{ textAlign: 'center' }}>
        {/* Mode selection - only show when not in online mode */}
        {!onlineMode && (
          <div style={{ margin: '20px 0 10px' }}>
            <button
              onClick={() => this.switchMode(false)}
              style={{
                padding: '8px 20px',
                margin: '0 5px',
                border: '2px solid #5a4a2a',
                borderRadius: '4px',
                background: !vsAI ? '#5a4a2a' : 'transparent',
                color: !vsAI ? '#fff' : '#5a4a2a',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              👥 人人对战
            </button>
            <button
              onClick={() => this.switchMode(true)}
              style={{
                padding: '8px 20px',
                margin: '0 5px',
                border: '2px solid #5a4a2a',
                borderRadius: '4px',
                background: vsAI ? '#5a4a2a' : 'transparent',
                color: vsAI ? '#fff' : '#5a4a2a',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              🤖 人机对战
            </button>
          </div>
        )}

        {/* AI 难度选择（仅人机模式显示） */}
        {!onlineMode && vsAI && (
          <div style={{ marginBottom: '10px' }}>
            {Object.entries(DIFFICULTY).map(([key, { label }]) => (
              <button
                key={key}
                onClick={() => this.setState({ difficulty: key })}
                style={{
                  padding: '4px 14px',
                  margin: '0 3px',
                  border: '1.5px solid #5a4a2a',
                  borderRadius: '3px',
                  background: this.state.difficulty === key ? '#5a4a2a' : 'transparent',
                  color: this.state.difficulty === key ? '#fff' : '#5a4a2a',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* 状态提示 */}
        <h2 style={{ margin: '10px 0', color: (onlineMode && currentPlayer === myPlayer && gameStarted) ? '#4caf50' : '#333' }}>
          {statusText}
        </h2>

        <canvas
          ref={this.canvasRef}
          style={{
            display: 'block',
            margin: '0 auto',
            maxWidth: '100%',
            borderRadius: '4px',
            boxShadow: '-2px -2px 2px #efefef, 5px 5px 5px #b9b9b9',
            cursor: clickable ? 'pointer' : 'default'
          }}
          onClick={e => { this.oneStep(e) }}
        />

        {/* Undo/Redo - only show in local mode when game is not over */}
        {!onlineMode && !gameOver && <UndoRedo onCustomUndo={this.handleUndo} />}

        {/* 底部按钮 */}
        <div style={{ marginTop: '15px' }}>
          {/* 返回大厅 - 对所有模式都可用 */}
          {this.props.onLeaveRoom && (
            <button
              onClick={() => { wsService.disconnect(); this.props.onLeaveRoom(); }}
              style={{
                padding: '8px 20px',
                margin: '0 5px',
                border: '2px solid #5a4a2a',
                borderRadius: '4px',
                background: 'transparent',
                color: '#5a4a2a',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              🏠 返回大厅
            </button>
          )}
          {/* 重新开局 */}
          <button
            onClick={this.resetGame}
            style={{
              padding: '8px 20px',
              margin: '0 5px',
              border: '2px solid #5a4a2a',
              borderRadius: '4px',
              background: (gameOver || onlineMode) ? '#5a4a2a' : 'transparent',
              color: (gameOver || onlineMode) ? '#fff' : '#5a4a2a',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            🔄 重新开局
          </button>
        </div>
      </div>
    )
  }
}