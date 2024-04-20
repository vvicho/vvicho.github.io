import { useEffect, useState } from 'react'
import reactLogo from '/src/assets/react.svg'
import viteLogo from '/vite.svg'
import Select from 'react-select';
import './App.css'
import CardMatrix from './components/CardMatrix'
import { loadObject, saveObject } from './utils/WriteReadBroker.js'
import cardFile from '/src/assets/allCards.json'
import sets from '/src/assets/sets.json'

function App() {
  const VisibilityState = {
    ALL_CARDS: 1,
    MISSING_CARDS: 2,
    COLLECTED_CARDS: 3,
  };

  const [allCards, _setAllCards] = useState(cardFile);
  const [collection, setCollection] = useState({});
  const [showControls, setShowControls] = useState(true);
  const [currentCollection, setCurrentCollection] = useState('k');
  const [saveInputText, setSaveInputText] = useState('');
  const [visibleCollection, setVisibleCollection] = useState({})
  const [selectedCollectionText, setSelectedCollectionText] = useState('');
  const [showCollectionState, setShowCollectionState] = useState(VisibilityState.ALL_CARDS);

  useEffect(() => toggleShowCards(showCollectionState), [allCards])

  // Add to the amount of specified card id
  function addToCard(cardId) {
    if (collection[cardId] == null) {
      collection[cardId] = 0;
    }

    collection[cardId]++;
    allCards[cardId].amount++
    setCollection({ ...collection })
    toggleShowCards(showCollectionState)
    // saveLocalStorage('collection', collection);
  }

  // Reduce the amount a specific cardId
  function reduceCard(cardId) {
    if (collection[cardId] == null) {
      return
    }

    collection[cardId]--;
    allCards[cardId].amount--;
    if (collection[cardId] <= 0) {
      delete collection[cardId];
      allCards[cardId].amount = 0;
    }

    setCollection({ ...collection })
    toggleShowCards(showCollectionState)
    // saveLocalStorage('collection', collection);
  }

  // Callback function that adds or removes cards from current selection
  function addReduceCardAmountWrapper(action, cardId) {
    if (action >= 0) {
      addToCard(cardId)
      return;
    }

    reduceCard(cardId)
  }

  // Get Collection by Name
  function getCollection(name) {
    setCurrentCollection(name);
    if (currentCollection == '' || currentCollection == null) {
      return allCards;
    }

    const result = loadDataWithKey(name)
    setCollection(result);
    return result;
  }

  // Toggle cards to show
  const toggleShowCards = (val) => {
    setShowCollectionState(val);
    switch (val) {
      case VisibilityState.ALL_CARDS: showAllCards(); break;
      case VisibilityState.COLLECTED_CARDS: showCollectedCards(); break;
      case VisibilityState.MISSING_CARDS: showOnlyMissingCards(); break;
    }
  }

  // Show all cards
  function showAllCards() {
    setVisibleCollection(allCards);
  }

  // Only show collected cards
  const showCollectedCards = () => {
    const col = {};
    Object.values(allCards)
      .filter(card => collection[card.parallelId] && collection[card.parallelId] !== 0)
      .map(card => col[card.parallelId] = card);
    setVisibleCollection(col);
  }

  // Only show missing cards
  const showOnlyMissingCards = () => {
    const col = {};
    Object.values(allCards)
      .filter(card => !collection[card.parallelId] || collection[card.parallelId] === 0)
      .map(card => col[card.parallelId] = card);
    setVisibleCollection(col);
  }

  // Save collection into local storage
  const saveCollection = () => {
    saveLocalStorage(saveInputText, collection);
    setSelectedCollectionText(saveInputText);
  }

  // Save collection with key
  function saveLocalStorage(key, values) {
    saveObject(key, JSON.stringify(values));
  }

  // Load collection with key
  function loadDataWithKey(key) {
    return JSON.parse(loadObject(key));
  }

  return (
    <>
      <div>
        <button onClick={() => setShowControls(!showControls)}>Toggle controls</button>
        <div>
          <input onChange={event => setSaveInputText(event.target.value)} type='text' />
          <button onClick={() => saveCollection()}>Save</button>
        </div>
        <div>
          <Select
            onChange={(value, _) => setCurrentCollection(value.value)}
            options={Object.keys(localStorage).filter(x => x !== 'debug').map(x => { return { value: x, label: x } })}
            defaultValue={{ value: currentCollection, label: currentCollection }}
          />
          {/* <select value={selectedCollectionText} onChange={evt => setCurrentCollection(evt.target.value)} >
            {Object.keys(localStorage).filter(x => x !== 'debug').map(x => <option selected={x === currentCollection} key={x} value={x}>{x}</option>)}
          </select> */}
          <button onClick={() => { getCollection(currentCollection) }}>Load</button>
        </div>
        <div>
          <button onClick={() => toggleShowCards(VisibilityState.ALL_CARDS)}>Show all cards</button>
          <button onClick={() => toggleShowCards(VisibilityState.COLLECTED_CARDS)}>Show collected cards</button>
          <button onClick={() => toggleShowCards(VisibilityState.MISSING_CARDS)}>Show missing cards</button>
        </div>
        <CardMatrix
          cardAmount={collection}
          cardsData={visibleCollection}
          callback={addReduceCardAmountWrapper}
          showControls={showControls}
          size="200px"
        />

      </div>
    </>
  )
}

export default App
