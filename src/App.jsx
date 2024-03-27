import { useEffect, useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import CardMatrix from './components/CardMatrix'
// import { loadObject, saveObject } from './utils/WriteReadBroker'
// import getFilesInDir from './utils/filesUtils'


function App() {
  const numCards = {
    "EB01": 61,
    "OP01": 121,
    "OP02": 121,
    "OP03": 123,
  }

  const [count, setCount] = useState(0)
  const [cards, setCards] = useState({});
  const padNumber = num => {
    var s = "000000000" + num;
    return s.substr(-3);
  }
  const fillCards = () => {
    const myCards = {};
    // console.log(JSON.stringify(localStorage.getItem('collection')))
    if (loadDataWithKey('collection') != null) {
      console.log(loadDataWithKey('collection'));
      setCards(loadDataWithKey('collection'));
      return;
    };
    Object.keys(numCards)
      .map(
        key => {
          for (var i = 1; i <= numCards[key]; i++) {
            var id = `${key}-${padNumber(i)}`;
            myCards[id] = { uri: `src/assets/cards/${key}/${id}.png`, amount: 0, cardId: id };
          }
        }
      )
    setCards(myCards);
    console.log('saving init');
    saveLocalStorage('collection', myCards);
    console.log(loadDataWithKey('collection'));
  }

  useEffect(fillCards, []);

  function addToCard(cardId) {
    const amount = cards[cardId].amount;
    cards[cardId].amount++;
    setCards({ ...cards })
    console.log('saving add');
    saveLocalStorage('collection', cards);
  }

  function reduceCard(cardId) {
    if (cards[cardId].amount <= 0) return;
    cards[cardId].amount--;
    setCards({ ...cards })
    console.log('saving minus')
    saveLocalStorage('collection', cards);
  }

  function addReduceCardAmountWrapper(action, cardId) {
    if (action >= 0) addToCard(cardId);
    else reduceCard(cardId);
  }

  function saveLocalStorage(key, values) {
    saveObject(key, JSON.stringify(values));
  }

  function loadDataWithKey(key) {
    return JSON.parse(loadObject(key));
  }

  return (
    <>
      <div>
        <CardMatrix cardsData={cards} callback={addReduceCardAmountWrapper} showControls={true} size="200px" />
        <a href="https://vitejs.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.jsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

export default App
