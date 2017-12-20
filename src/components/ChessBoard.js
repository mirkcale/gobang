/**
 * Created by lyy on 2017/12/19.
 */
import React, { Component } from 'react'
import { ActionCreators as UndoActionCreators } from 'redux-undo'
import UndoRedo from '../container/UndoRedo'
import addChessCreator from '../redux/actions/addChess'
import resetGameCreator from '../redux/actions/resetGame'

const GRID_COUNT = 15

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
      vsAI: false,
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
    this.handleResize()
    window.addEventListener('resize', this.handleResize)
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.handleResize)
    if (this.aiTimer) clearTimeout(this.aiTimer)
  }

  // 切换对战模式
  switchMode(vsAI) {
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
    this.lastMove = null
    if (this.state.gameOver) {
      this.setState({ gameOver: false, winner: null })
    }
    this.props.dispatch(UndoActionCreators.undo())
    if (this.state.vsAI) {
      setTimeout(() => this.props.dispatch(UndoActionCreators.undo()), 0)
    }
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
    const { black, white } = container || this.props.golang.present.container
    black.forEach(i => this.drawChess(i[0], i[1], 'black'))
    white.forEach(i => this.drawChess(i[0], i[1], 'white'))
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

  // 检查某个位置是否已有棋子（使用指定 container）
  hasChessAt(x, y, container) {
    const { black, white } = container || this.props.golang.present.container
    return black.some(p => p[0] === x && p[1] === y) ||
      white.some(p => p[0] === x && p[1] === y)
  }

  hasChess(position) {
    return this.hasChessAt(position[0], position[1])
  }

  // ===================== AI 相关方法 =====================

  // 获取候选位置（已有棋子周围 n 格范围内的空位）
  getCandidates(container, n = 1) {
    const { black, white } = container || this.props.golang.present.container
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

    const container = this.props.golang.present.container
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

    const player = this.props.golang.present.player
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
    if (this.state.gameOver || this.state.aiThinking) return

    const player = this.props.golang.present.player

    // 人机模式：人类只能走白棋
    if (this.state.vsAI && player !== 'white') return

    const dpr = window.devicePixelRatio || 1
    const offsetX = e.nativeEvent.offsetX / dpr
    const offsetY = e.nativeEvent.offsetY / dpr

    const x = Math.round((offsetX - this.padding) / this.cellSize)
    const y = Math.round((offsetY - this.padding) / this.cellSize)

    if (x < 0 || x >= GRID_COUNT || y < 0 || y >= GRID_COUNT) return
    if (this.hasChessAt(x, y)) return

    // 记录最后落子位置
    this.lastMove = { x, y, player }

    const won = this.checkWinAfterPlace(x, y, player)
    if (won) {
      this.setState({ gameOver: true, winner: player })
    }

    this.props.dispatch(addChessCreator([x, y], player))

    // 人机模式：人类落子后触发 AI
    if (this.state.vsAI && !won) {
      setTimeout(() => this.doAIMove(), 300)
    }
  }

  checkWinAfterPlace(x, y, player, container) {
    const pieces = (container || this.props.golang.present.container)[player]
    const directions = [[1, 0], [0, 1], [1, 1], [1, -1]]

    for (const [dx, dy] of directions) {
      let count = 1
      for (let i = 1; i < 5; i++) {
        if (pieces.some(p => p[0] === x + dx * i && p[1] === y + dy * i)) {
          count++
        } else break
      }
      for (let i = 1; i < 5; i++) {
        if (pieces.some(p => p[0] === x - dx * i && p[1] === y - dy * i)) {
          count++
        } else break
      }
      if (count >= 5) return true
    }
    return false
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
    const prevContainer = this.props.golang.present.container
    const nextContainer = nextProps.golang.present.container

    if (nextContainer !== prevContainer) {
      this.redrawAll(nextContainer)
    }
  }

  render() {
    const { gameOver, winner, vsAI, aiThinking } = this.state
    const currentPlayer = this.props.golang.present.player
    const playerText = currentPlayer === 'black' ? '黑棋' : '白棋'

    let statusText
    if (gameOver) {
      const winnerText = winner === 'black' ? '黑棋' : '白棋'
      statusText = `${winnerText}获胜！`
    } else if (aiThinking) {
      statusText = 'AI 思考中...'
    } else {
      statusText = `当前落子方：${playerText}`
    }

    return (
      <div style={{ textAlign: 'center' }}>
        {/* 模式选择 */}
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

        {/* AI 难度选择（仅人机模式显示） */}
        {vsAI && (
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
        <h2 style={{ margin: '10px 0' }}>
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
            cursor: (gameOver || aiThinking || (vsAI && currentPlayer === 'black')) ? 'default' : 'pointer'
          }}
          onClick={e => { this.oneStep(e) }}
        />

        {!gameOver && <UndoRedo onCustomUndo={this.handleUndo} />}

        {/* 胜负已分：重新开局按钮 */}
        {gameOver && (
          <button
            onClick={this.resetGame}
            style={{
              marginTop: '15px',
              padding: '8px 20px',
              border: '2px solid #5a4a2a',
              borderRadius: '4px',
              background: '#5a4a2a',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            🔄 重新开局
          </button>
        )}
      </div>
    )
  }
}