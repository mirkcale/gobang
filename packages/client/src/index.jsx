import React from 'react'
import { render } from 'react-dom'
import { createStore } from 'redux'
import { Provider } from 'react-redux'
import { BrowserRouter, Route, Switch } from 'react-router-dom'
import App from './views/app/App'
import Lobby from './views/lobby/Lobby'
import golang from './redux/reducers'

let store = createStore(golang, window.__REDUX_DEVTOOLS_EXTENSION__ && window.__REDUX_DEVTOOLS_EXTENSION__())

function Root() {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <Switch>
          <Route path="/game/:roomId" component={App} />
          <Route path="/game" component={App} />
          <Route path="/" component={Lobby} />
        </Switch>
      </BrowserRouter>
    </Provider>
  )
}

let rootElement = document.getElementById('root')
render(
  <Root />,
  rootElement
)