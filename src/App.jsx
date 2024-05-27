import React, { useEffect, useState } from 'react';
import Select from 'react-select';
import './App.css';
import CardMatrix from './components/CardMatrix';
import { loadObject, saveObject } from './utils/WriteReadBroker.js';
import cardFile from '/src/assets/allCards.json';
import donCards from '/src/assets/donCards.json';
import allSets from '/src/assets/sets.json';
import CardExportScreen from './components/CardExportScreen.jsx';
import { exportComponentAsPNG } from 'react-component-export-image';
import { defaultSort, filterCardsByName, sortCards } from './utils/SortAndFilters.js';

function App() {
  const VisibilityState = {
    ALL_CARDS: 1,
    MISSING_CARDS: 2,
    COLLECTED_CARDS: 3,
  };

  const [allCards, _setAllCards] = useState({ ...cardFile, ...donCards });
  const [collection, setCollection] = useState({});
  const [showControls, setShowControls] = useState(true);
  const [currentCollection, setCurrentCollection] = useState('Trades');
  const [saveInputText, setSaveInputText] = useState('');
  const [visibleCollection, setVisibleCollection] = useState(allCards)
  const [filteredCards, setFilteredCards] = useState(allCards);
  const [selectedCollectionText, setSelectedCollectionText] = useState('');
  const [showCollectionState, setShowCollectionState] = useState(VisibilityState.ALL_CARDS);
  const [showExportScreen, setShowExportScreen] = useState(false);
  const [cardNameFilterText, setCardFilterText] = useState('');
  const [onlyAlts, setOnlyAlts] = useState(false);
  const [noAlts, setNoAlts] = useState(false);
  const [addCardsBulkInputText, setAddCardsBulkInputText] = useState(0);
  const compRef = React.createRef();
  const [uniqueSets, _] = useState(['', ...Object.values(allSets).filter(x => x != 'LP')]);
  const [selectedSet, setSelectedSet] = useState('');
  const [collectionNameDropdownOption, setCollectionNameDropdownOption] = useState({});

  useEffect(() => {
    toggleShowCards(showCollectionState);
    getCollection(currentCollection);
  }, [allCards]);

  useEffect(() => { filterCards(filteredCards) }, [showCollectionState])

  // Add to the amount of specified card id
  function addToCard(cardId, qty = 1) {
    const qtyAsNumber = Number(qty);
    if (collection[cardId] == null) {
      collection[cardId] = 0;
    }

    collection[cardId] += qtyAsNumber;
    allCards[cardId].amount += qtyAsNumber;
    setCollection({ ...collection })
    toggleShowCards(showCollectionState)
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
    setSaveInputText(name);
    return result;
  }

  // Toggle cards to show
  const toggleShowCards = (val) => {
    setShowCollectionState(val);
    filterCards(visibleCollection, onlyAlts, noAlts, val)
  }

  const toggleAlts = () => {
    const showOnlyAlts = !onlyAlts;
    let showNoAlts = noAlts;
    setOnlyAlts(showOnlyAlts);
    if (showOnlyAlts) {
      showNoAlts = false;
      setNoAlts(showNoAlts);
    }
    filterCards(visibleCollection, showOnlyAlts, showNoAlts);
  }

  const toggleNoAlts = () => {
    const showNoAlts = !noAlts;
    let showOnlyAlts = onlyAlts;
    setNoAlts(showNoAlts);
    if (showNoAlts) {
      showOnlyAlts = false;
      setOnlyAlts(showOnlyAlts);
    }
    filterCards(visibleCollection, showOnlyAlts, showNoAlts)
  }

  const getCollectedCards = () => {
    let col = {};
    Object.values(allCards)
      .filter(card => collection[card?.parallelId] && collection[card?.parallelId] !== '')
      .map(card => col[card?.parallelId] = card);
    col = defaultSort(col, 'parallelId');
    return col;
  }


  // Save collection into local storage
  const saveCollection = () => {
    saveLocalStorage(saveInputText, collection);
    setSelectedCollectionText(saveInputText);
    setCollectionNameDropdownOption({ value: saveInputText, label: saveInputText })
  }

  // Save collection with key
  function saveLocalStorage(key, values) {
    saveObject(key, JSON.stringify(values));
  }

  // Load collection with key
  function loadDataWithKey(key) {
    return JSON.parse(loadObject(key));
  }

  function exportCards() {
    const collectionKeys = Object.keys(collection);
    const val = collectionKeys.map(x => `${filteredCards[x].name} ${x} x ${collection[x]}`);
    navigator.clipboard.writeText(val.join('\n'));
    setShowExportScreen(true);
    exportComponentAsPNG(compRef, { fileName: currentCollection });
  }

  function clearCollection() {
    setCollection({})
  }

  useEffect(() => {
    filterCards(visibleCollection, onlyAlts, noAlts)
  }, [selectedSet, cardNameFilterText]);

  function filterCards(col, showOnlyAlts = onlyAlts, showNoAlts = noAlts, collectionState = showCollectionState) {
    // setCardFilterText(val);
    let cards = filterCardsByName(col ?? visibleCollection,
      collection,
      {
        'name': cardNameFilterText,
        'cardSetCode': selectedSet,
      }, showOnlyAlts,
      showNoAlts,
      collectionState === VisibilityState.COLLECTED_CARDS,
      collectionState === VisibilityState.MISSING_CARDS,
    );
    // const cardObjects = Object.values(cards)
    // cardObjects.sort(sortCards);
    // const sortedCards = {};
    // cardObjects.map(x => sortedCards[x.parallelId] = x);
    // setFilteredCards(sortedCards);
    setFilteredCards(cards);
  }

  function addCardsBulk() {
    const cardIds = Object.keys(filteredCards);
    cardIds.forEach(cardId => addToCard(cardId, addCardsBulkInputText));
  }

  function deleteCollection() {
    clearCollection();
    delete localStorage[currentCollection];
    setCurrentCollection('')
    setSaveInputText('');
    setCollectionNameDropdownOption({});
  }

  return (
    <>
      <div id='expand-me' style={{ display: 'none' }}>
        <pre>
          ⠀⠀⠀⠀⣠⣶⣶⣶⣶⣤⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣠⣴⣶⣶⣶⣄⠀⠀⠀⠀
          ⠀⠀⠀⢰⣿⠋⠀⠀⠉⢻⣿⡆⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣾⣿⠋⠀⠀⠉⣿⣆⣀⠀⠀
          ⢀⣶⣿⠿⠿⠀⠀⠀⠀⢠⣿⠇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣀⣀⣀⣀⣀⣀⣀⣀⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⡇⠀⠀⠀⠀⠛⠻⢿⣷⡄
          ⢸⣿⠁⠀⠀⠀⠀⠀⠀⢻⣿⣆⠀⠀⠀⠀⠀⠀⢀⣀⣤⣶⣶⣿⣿⣿⣿⣿⠿⠿⠿⠿⣿⣿⣿⣿⣿⣷⣶⣤⣄⡀⠀⠀⠀⠀⠀⢀⣴⣿⠟⠀⠀⠀⠀⠀⠀⠀⣿⣷
          ⠘⣿⣧⡀⠀⢀⣀⠀⠀⠀⠙⢿⣷⣄⠀⢀⣴⣾⣿⣿⠿⠟⠋⠉⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠉⠙⠛⠿⣿⣿⣷⣦⣀⠀⣰⣿⠟⠁⠀⠀⠀⣠⣀⠀⠀⣠⣿⠇
          ⠀⠈⠻⠿⠿⠿⢿⣷⣄⠀⠀⠀⠙⣿⣿⣿⡿⠟⠋⠀⠀⣀⣠⣤⣶⣶⣿⣿⣿⣿⣿⣿⣿⣿⣶⣶⣦⣤⣀⠀⠀⠉⠻⢿⣿⣿⣿⠋⠀⠀⠀⣠⣾⡿⠿⢿⣿⠿⠋⠀
          ⠀⠀⠀⠀⠀⠀⠀⠙⢿⣷⣄⣠⣾⣿⡿⠋⠀⠀⣠⣴⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣶⣄⡀⠀⠙⠿⣿⣷⣄⣠⣾⡿⠃⠀⠀⠀⠀⠀⠀⠀
          ⠀⠀⠀⠀⠀⠀⠀⠀⠀⢹⣿⣿⡿⠋⠀⢀⣴⣿⣿⣿⣿⣿⡿⠟⠛⠉⠉⠀⠀⠀⠀⠀⠀⠈⠉⠙⠛⠿⣿⣿⣿⣿⣿⣦⡀⠀⠘⢿⣿⣿⣏⠀⠀⠀⠀⠀⠀⠀⠀⠀
          ⠀⠀⠀⠀⠀⠀⠀⠀⣴⣿⣿⠟⠀⠀⣴⣿⣿⣿⣿⡿⠛⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠙⢿⣿⣿⣿⣿⣦⡀⠀⠙⣿⣿⣧⠀⠀⠀⠀⠀⠀⠀⠀
          ⠀⠀⠀⠀⠀⠀⢀⣾⣿⣿⠋⠀⢠⣾⣿⣿⣿⣿⠋⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠙⢿⣿⣿⣿⣿⣄⠀⠘⢿⣿⣷⡀⠀⠀⠀⠀⠀⠀
          ⠀⠀⠀⠀⠀⠀⣾⣿⣿⠃⠀⢠⣿⣿⣿⣿⣿⣁⣀⣀⣤⣤⣤⣤⣤⠶⠶⠶⠶⠶⠶⠶⠶⠶⠶⠶⢶⣤⣤⣤⣤⣤⣌⣿⣿⣿⣿⣿⣆⠀⠈⢿⣿⣷⠀⠀⠀⠀⠀⠀
          ⠀⠀⠀⠀⠀⢸⣿⣿⠃⠀⢠⣿⣿⣿⣿⡿⠛⠉⠉⠉⠀⠀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⠀⠀⠉⠉⢻⣿⣿⣿⣿⣆⠀⠈⣿⣿⣇⠀⠀⠀⠀⠀
          ⠀⠀⠀⠀⠀⣿⣿⡏⠀⢠⣿⣿⣿⣿⡿⠷⠶⠞⠛⠛⠛⠋⠉⠉⠉⠉⠉⠁⠀⠀⠀⠀⠀⠀⠉⠉⠉⠉⠉⠉⠙⠛⠛⠛⠺⠿⠿⣿⣿⣿⣆⡀⠘⣿⣿⡄⠀⠀⠀⠀
          ⠀⠀⠀⠀⢸⣿⣿⡶⠾⠛⠋⠉⠁⠀⢀⣠⣤⣶⡶⠶⠾⠛⠛⠛⠛⠛⠋⠉⠉⠉⠉⠉⠉⠙⠛⠛⠛⠛⠛⠛⠻⠿⠷⠶⢶⣤⠀⠀⠀⠈⠉⠛⠻⠿⣿⣇⠀⠀⠀⠀
          ⠀⠀⠀⠀⢸⣿⣥⣤⣤⣀⣀⣀⣀⣰⣿⠉⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢹⣧⣀⣤⣤⣤⡤⠴⢶⣿⣿⠀⠀⠀⠀
          ⠀⠀⠀⠀⣼⣿⡇⠀⢸⣿⣿⣿⣿⣿⣿⠀⠀⠀⠀⣠⣶⣿⣿⣿⣿⣶⣄⠀⠀⠀⠀⠀⠀⣠⣶⣿⣿⣿⣿⣷⣦⡀⠀⠀⠀⣼⣿⣿⣿⣿⣿⡇⠀⢸⣿⣿⠀⠀⠀⠀
          ⠀⠀⠀⠀⢿⣿⡇⠀⢸⣿⣿⣿⣿⣿⣿⡄⠀⠀⣰⣿⣿⣿⣿⣿⣿⣿⣿⣧⠀⠀⠀⠀⣸⣿⣿⣿⣿⣿⣿⣿⣿⣷⠀⠀⠀⣿⣿⣿⣿⣿⣿⡇⠀⢸⣿⣿⠀⠀⠀⠀
          ⠀⠀⠀⠀⢸⣿⣷⠀⠀⣿⣿⣿⣿⣿⣿⣧⠀⠀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀⠀⠀⠀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀⠀⣸⣿⣿⣿⣿⣿⣿⠇⠀⢸⣿⣿⠀⠀⠀⠀
          ⠀⠀⠀⠀⢸⣿⣿⠀⠀⢿⣿⣿⣿⣿⣿⣿⣇⠀⢹⣿⣿⣿⣿⣿⣿⣿⣿⡿⠀⠀⠀⠀⠹⣿⣿⣿⣿⣿⣿⣿⣿⡿⠀⢠⣿⣿⣿⣿⣿⣿⣿⠀⠀⣿⣿⡟⠀⠀⠀⠀
          ⠀⠀⠀⠀⠈⣿⣿⡇⠀⠘⣿⣿⣿⣿⣿⣿⣿⣦⠀⠙⢿⣿⣿⣿⣿⡿⠟⠁⠀⣀⣀⡀⠀⠙⠿⣿⣿⣿⣿⡿⠟⠁⣰⣿⣿⣿⣿⣿⣿⣿⡏⠀⢠⣿⣿⠇⠀⠀⠀⠀
          ⠀⠀⠀⠀⠀⢹⣿⣿⡀⠀⠹⣿⣿⣿⣿⣿⣿⣿⣷⣄⠀⠀⠉⠉⠁⠀⠀⠀⢸⣿⣿⣿⠀⠀⠀⠀⠈⠉⠀⠀⣠⣾⣿⣿⣿⣿⣿⣿⣿⡟⠀⠀⣾⣿⡟⠀⠀⠀⠀⠀
          ⠀⠀⠀⠀⠀⠈⢿⣿⣷⡀⠀⠹⣿⣿⣿⣿⣿⣿⣿⣿⣷⣦⣀⠀⠀⠀⠀⠀⠈⠻⠿⠋⠀⠀⠀⠀⠀⢀⣤⣾⣿⣿⣿⣿⣿⣿⣿⣿⡿⠁⠀⣼⣿⡿⠁⠀⠀⠀⠀⠀
          ⠀⠀⠀⠀⠀⠀⠈⢿⣿⣷⡀⠀⠙⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣶⣦⣤⣄⣀⣀⣀⣀⣠⣤⣤⡶⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠟⠀⠀⣼⣿⡿⠁⠀⠀⠀⠀⠀⠀
          ⠀⠀⠀⠀⠀⠀⠀⠈⢿⣿⣿⣄⠀⠈⠻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣅⣸⡏⠉⢹⡟⠛⢻⡋⠉⣿⣀⣸⣿⣿⣿⣿⣿⣿⣿⣿⡿⠃⠀⢠⣾⣿⡟⠁⠀⠀⠀⠀⠀⠀⠀
          ⠀⠀⠀⠀⠀⠀⠀⢀⣴⣿⣿⣿⣷⣄⠀⠈⠻⢿⣿⣿⣿⣿⣿⡇⠈⣿⠛⠓⣿⠷⠶⢾⡗⠛⢻⡏⠀⣿⣿⣿⣿⣿⣿⠟⠉⠀⢀⣴⣿⣿⠿⣿⣦⡀⠀⠀⠀⠀⠀⠀
          ⠀⣠⣶⣿⣿⣶⣶⣿⠟⠁⠈⠻⣿⣿⣷⣄⠀⠀⠙⠻⢿⣿⣿⡷⢴⣯⣀⣀⣿⠀⠀⢸⣇⣀⣠⣷⡶⣿⣿⣿⠟⠋⠁⠀⣠⣴⣿⣿⡟⠁⠀⠈⠻⣿⣶⡿⢿⣶⣄⠀
          ⢰⣿⠋⠁⠀⠈⠙⠁⠀⠀⢀⣴⣿⠟⢿⣿⣿⣶⣄⡀⠀⠈⠙⢿⡀⠀⠉⠉⠉⠉⠉⠉⠉⠉⠁⠀⢰⡟⠉⠀⠀⣠⣴⣾⣿⡿⠟⠻⣿⣦⡀⠀⠀⠈⠁⠀⠀⠙⣿⡆
          ⢸⣿⡀⠀⠀⠀⠀⠀⠀⢴⣿⠟⠁⠀⠀⠈⠛⢿⣿⣿⣷⣶⣤⣀⣻⣦⣄⡀⠀⠀⠀⠀⠀⢀⣠⣴⣏⣠⣴⣶⣿⣿⡿⠟⠉⠀⠀⠀⠈⣻⣿⠆⠀⠀⠀⠀⠀⠀⣿⡇
          ⠈⠿⣷⣦⣴⡆⠀⠀⠀⢸⣿⠀⠀⠀⠀⠀⠀⠀⠈⠙⠛⠿⣿⣿⣿⣿⣿⣿⣿⣷⣶⣾⣿⣿⣿⣿⣿⣿⠿⠟⠋⠁⠀⠀⠀⠀⠀⠀⢠⣿⡇⠀⠀⠀⠀⣶⣶⣾⠿⠁
          ⠀⠀⠀⠉⣿⣇⡀⠀⣀⣾⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠉⠉⠙⠛⠛⠛⠛⠛⠛⠛⠉⠉⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⢿⣷⣄⠀⠀⣠⣿⠇⠀⠀⠀
          ⠀⠀⠀⠀⠈⠛⠿⠿⠿⠛⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠙⠻⠿⠿⠟⠋⠀⠀⠀⠀
        </pre>
      </div>
      <div>
        <button onClick={() => setShowControls(!showControls)}>Toggle controls</button>
        <div>
          <div>
            <span>Collection Name: </span>
            <input value={saveInputText} onChange={event => setSaveInputText(event.target.value)} type='text' />
          </div>
          <button onClick={() => saveCollection()}>Save</button>
          <button onClick={() => deleteCollection()}>Delete</button>
          <button onClick={() => clearCollection()}>Clear</button>
          <button onClick={() => exportCards()}>Export to PNG</button>
        </div>
        <div className='dropdownRow'>
          <span>Collection: </span>
          <Select
            className='collectionNameDropdown dropdownRowElement'
            onChange={(value, _) => {
              setCurrentCollection(value.value)
              setCollectionNameDropdownOption(value);
            }}
            value={collectionNameDropdownOption}
            options={Object.keys(localStorage).filter(x => x !== 'debug').map(x => { return { value: x, label: x } })}
            defaultValue={{ value: currentCollection, label: currentCollection }}
          />

          <button className='dropdownRowElement' onClick={() => { getCollection(currentCollection); }}>Load Collection</button>
        </div>
        <div>
          <span>Filter by name: </span>
          <input value={cardNameFilterText} onChange={event => setCardFilterText(event.target.value)} type='text' />
        </div>
        <div>
          <button className={showCollectionState === VisibilityState.ALL_CARDS ? 'buttonActive' : 'buttonInactive'} onClick={() => toggleShowCards(VisibilityState.ALL_CARDS)}>Show all cards</button>
          <button className={showCollectionState === VisibilityState.COLLECTED_CARDS ? 'buttonActive' : 'buttonInactive'} onClick={() => toggleShowCards(VisibilityState.COLLECTED_CARDS)}>Show collected cards</button>
          <button className={showCollectionState === VisibilityState.MISSING_CARDS ? 'buttonActive' : 'buttonInactive'} onClick={() => toggleShowCards(VisibilityState.MISSING_CARDS)}>Show missing cards</button>
        </div>
        <div>
          <button className={onlyAlts ? 'buttonActive' : 'buttonInactive'} onClick={() => toggleAlts()}>Toggle Alts</button>
          <button className={noAlts ? 'buttonActive' : 'buttonInactive'} onClick={() => toggleNoAlts()}>No Alts</button>
        </div>
        <div>
          <div>
            <span><span>Add </span><input value={addCardsBulkInputText} onChange={event => setAddCardsBulkInputText(event.target.value)} /><span> of each card
            </span> </span>
            <button onClick={() => addCardsBulk()}>Add</button>
          </div>
        </div>
        <div className='dropdownRow'>
          <span>Set: </span>
          <Select
            className='collectionNameDropdown dropdownRowElement'
            onChange={(value, _) => setSelectedSet(value.value)}
            options={uniqueSets.map(x => { return { value: x, label: x } })}
            defaultValue={{ value: selectedSet, label: selectedSet }}
          />
        </div>
        <CardMatrix
          cardAmount={collection}
          cardsData={filteredCards}
          callback={addReduceCardAmountWrapper}
          showControls={showControls}
          size="200px"
        />
        <CardExportScreen ref={compRef}
          cardAmount={collection}
          cardsData={getCollectedCards()}
        />

      </div >
    </>
  )
}

export default App
