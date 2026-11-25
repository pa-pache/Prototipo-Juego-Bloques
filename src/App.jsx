import './App.css'
import GamePlayer from './elements/GamePlayer'

function App() {
  return (
    <div style={{
        display: "flex", 
        flexDirection: "row",
        gap: '60px',
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
      }}
    >
      <GamePlayer />
    </div>
  )
}

export default App