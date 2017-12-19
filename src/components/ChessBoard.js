/**
 * Created by lyy on 2017/12/19.
 */
import React, { Component } from 'react'
import addChessCreator from '../redux/actions/addChess'

export default class chessboard extends Component {
  constructor (props) {
    super(props);
    this.drawChessBoard = this.drawChessBoard.bind(this)
    this.drawChess = this.drawChess.bind(this)
  }

  componentDidMount () {
    this.drawChessBoard()
    // document.getElementById('chessboard').addEventListener('click', (e => this.drawChess(e)))
  }

  drawChessBoard () {
    var chess = document.getElementById("chessboard");
    var context = chess.getContext('2d');

    context.strokeStyle = '#bfbfbf'; // 边框颜色
    for (var i = 0; i < 15; i++) {
      context.moveTo(15 + i * 30, 15);
      context.lineTo(15 + i * 30, 435);
      context.stroke();
      context.moveTo(15, 15 + i * 30);
      context.lineTo(435, 15 + i * 30);
      context.stroke();
    }
  }

  drawChess (e) {
    var chess = document.getElementById("chessboard");
    var context = chess.getContext('2d');
    var x =  Math.floor(e.nativeEvent.offsetX / 30);
    var y =  Math.floor(e.nativeEvent.offsetY/ 30);
    let player = this.props.golang ? this.props.golang.player : 'white'
    context.beginPath();
    context.arc(15 + x * 30, 15 + y * 30, 13, 0, 2 * Math.PI);//画圆
    context.closePath();
    //渐变
    var gradient = context.createRadialGradient(15 + x * 30 + 2, 15 + y * 30 - 2, 13, 15 + x * 30 + 2, 15 + y * 30 - 2, 0);

    if (player === 'black') {
      gradient.addColorStop(0, '#0a0a0a');
      gradient.addColorStop(1, '#636766');
    } else {
      gradient.addColorStop(0, '#d1d1d1');
      gradient.addColorStop(1, '#f9f9f9');
    }
    context.fillStyle = gradient;
    context.fill();
    this.props.dispatch(addChessCreator([x,y], player))
  }

  componentWillUnmount () {
    document.getElementById('chessboard').removeEventListener('click')
  }

  render () {
    return (
      <div>
        <canvas
          id="chessboard"
          width="450"
          height="450"
          style={{ display: 'block',
            margin: '50px auto',
            boxShadow: '-2px -2px 2px #efefef, 5px 5px 5px #b9b9b9'}}
          onClick={e => {this.drawChess(e)}}
        />
        {['悔棋', '撤销'].map(i => (
          <button key={i}>{i}</button>
        ))}
      </div>
    )
  }
}