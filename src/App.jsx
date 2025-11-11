import React, { useEffect, useRef, useState } from 'react';
// import Select from 'react-select';
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import Fab from '@mui/material/Fab';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import Divider from '@mui/material/Divider';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import './App.css';
import CardMatrix from './components/CardMatrix';
import { loadObject, saveObject } from './utils/WriteReadBroker.js';
import cardFile from '/src/assets/allCards.json';
import donCards from '/src/assets/donCards.json';
import allSets from '/src/assets/sets.json';
import CardExportScreen from './components/CardExportScreen.jsx';
import { exportComponentAsPNG } from 'react-component-export-image';
import { defaultSort, filterCardsByName, sortCards } from './utils/SortAndFilters.js';
import TagEditor from './features/TagEditor/TagEditor.tsx';
import SynergyGraphViewer from './components/SynergyGraphViewer.tsx';


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
  const exportRef = useRef(null);
  const [uniqueSets, _] = useState(['', ...Object.values(allSets).filter(x => x != 'LP')]);
  const [selectedSet, setSelectedSet] = useState('');
  const [collectionNameDropdownOption, setCollectionNameDropdownOption] = useState({});
  const [showTagWorkbench, setShowTagWorkbench] = useState(false);
  const [showSynergyViewer, setShowSynergyViewer] = useState(false);

  // theme mode persisted
  const [themeMode, setThemeMode] = useState(localStorage.getItem('themeMode') ?? 'dark');
  const theme = React.useMemo(() => createTheme({ palette: { mode: themeMode } }), [themeMode]);

  // grid size persisted
  const sizeFromStorage = localStorage.getItem('cardSize') ?? 'medium';
  const [gridSize, setGridSize] = useState(sizeFromStorage);
  const sizeToPx = (val) => val === 'small' ? '140px' : (val === 'large' ? '260px' : '200px');
  const [showScrollTop, setShowScrollTop] = useState(false);
  
  const resetFilters = () => {
    setCardFilterText('');
    setSelectedSet('');
    setOnlyAlts(false);
    setNoAlts(false);
    setShowCollectionState(VisibilityState.ALL_CARDS);
    filterCards(visibleCollection, false, false, VisibilityState.ALL_CARDS);
  };

  function getCollectionKeys() {
    const exclude = new Set(['debug', 'themeMode', 'cardSize']);
    const keys = Object.keys(localStorage);
    const valid = [];
    for (const key of keys) {
      if (exclude.has(key)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          valid.push(key);
        }
      } catch (e) {
        // ignore non-JSON entries
      }
    }
    return valid;
  }

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

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

    const result = loadDataWithKey(name) ?? {};
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
      .filter(card => card && collection[card?.parallelId] && collection[card?.parallelId] !== '')
      .map(card => col[card?.parallelId] = card);
    col = defaultSort(col, 'parallelId');
    return col;
  }


  // Save collection into local storage
  const saveCollection = () => {
    saveLocalStorage(saveInputText, collection);
    setSelectedCollectionText(saveInputText);
    setCollectionNameDropdownOption(saveInputText)
  }

  // Save collection with key
  function saveLocalStorage(key, values) {
    saveObject(key, JSON.stringify(values));
  }

  // Load collection with key
  function loadDataWithKey(key) {
    return JSON.parse(loadObject(key));
  }

  function openExportPreview() {
    setShowExportScreen(true);
  }

  function copyExportText() {
    const collectionKeys = Object.keys(collection);
    const val = collectionKeys.map(x => `${filteredCards[x]?.name ?? allCards[x]?.name} ${x} x ${collection[x]}`);
    navigator.clipboard.writeText(val.join('\n'));
  }

  function saveExportPng() {
    // small delay to ensure any pending layout/loads settle
    setTimeout(() => {
      exportComponentAsPNG(exportRef, { fileName: currentCollection, backgroundColor: '#222', pixelRatio: 3 });
      setShowExportScreen(false);
    }, 50);
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
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AppBar position='sticky'>
          <Toolbar>
            <Typography variant='h6'>My TCG Collection</Typography>
            <div style={{ flex: 1 }} />
            <ToggleButtonGroup size='small' exclusive value={gridSize} onChange={(e, val) => { if (val) { setGridSize(val); localStorage.setItem('cardSize', val); } }}>
              <ToggleButton value='small'>S</ToggleButton>
              <ToggleButton value='medium'>M</ToggleButton>
              <ToggleButton value='large'>L</ToggleButton>
            </ToggleButtonGroup>
            <Button color='inherit' onClick={() => { const next = themeMode === 'dark' ? 'light' : 'dark'; setThemeMode(next); localStorage.setItem('themeMode', next); }} style={{ marginLeft: 8 }}>
              {themeMode === 'dark' ? 'Light' : 'Dark'} mode
            </Button>
            <Button color='inherit' onClick={() => openExportPreview()} style={{ marginLeft: 8 }}>Preview Export</Button>
            <Button color='inherit' onClick={() => setShowSynergyViewer(true)} style={{ marginLeft: 8 }}>Synergy Viewer</Button>
            <Button color='inherit' onClick={() => setShowTagWorkbench(true)} style={{ marginLeft: 8 }}>Tag Editor v2</Button>
          </Toolbar>
        </AppBar>
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
          ⠀⠀⠀⠀⠀⠈⢿⣿⣷⡀⠀⠹⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣶⣦⣤⣄⣀⣀⣀⣀⣠⣤⣤⡶⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠟⠀⠀⣼⣿⡿⠁⠀⠀⠀⠀⠀⠀
          ⠀⠀⠀⠀⠀⠀⠈⢿⣿⣿⣄⠀⠈⠻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣅⣸⡏⠉⢹⡟⠛⢻⡋⠉⣿⣀⣸⣿⣿⣿⣿⣿⣿⣿⣿⡿⠃⠀⢠⣾⣿⡟⠁⠀⠀⠀⠀⠀⠀⠀
          ⠀⠀⠀⠀⠀⠀⠀⢀⣴⣿⣿⣿⣷⣄⠀⠈⠻⢿⣿⣿⣿⣿⣿⡇⠈⣿⠛⠓⣿⠷⠶⢾⡗⠛⢻⡏⠀⣿⣿⣿⣿⣿⣿⠟⠉⠀⢀⣴⣿⣿⠿⣿⣦⡀⠀⠀⠀⠀⠀⠀
          ⠀⣠⣶⣿⣿⣶⣶⣿⠟⠁⠈⠻⣿⣿⣷⣄⠀⠀⠙⠻⢿⣿⣿⡷⢴⣯⣀⣀⣿⠀⠀⢸⣇⣀⣠⣷⡶⣿⣿⣿⠟⠋⠁⠀⣠⣴⣿⣿⡟⠁⠀⠈⠻⣿⣶⡿⢿⣶⣄⠀
          ⢰⣿⠋⠁⠀⠈⠙⠁⠀⠀⢀⣴⣿⠟⢿⣿⣿⣶⣄⡀⠀⠈⠙⢿⡀⠀⠉⠉⠉⠉⠉⠉⠉⠉⠁⠀⢰⡟⠉⠀⠀⣠⣴⣾⣿⡿⠟⠻⣿⣦⡀⠀⠀⠈⠁⠀⠀⠙⣿⡆
          ⢸⣿⡀⠀⠀⠀⠀⠀⠀⢴⣿⠟⠁⠀⠀⠈⠛⢿⣿⣿⣷⣶⣤⣀⣻⣦⣄⡀⠀⠀⠀⠀⠀⢀⣠⣴⣏⣠⣴⣶⣿⣿⡿⠟⠉⠀⠀⠀⠈⣻⣿⠆⠀⠀⠀⠀⠀⠀⣿⡇
          ⠈⠿⣷⣦⣴⡆⠀⠀⠀⢸⣿⠀⠀⠀⠀⠀⠀⠀⠈⠙⠛⠿⣿⣿⣿⣿⣿⣿⣿⣷⣶⣾⣿⣿⣿⣿⣿⣿⠿⠟⠋⠁⠀⠀⠀⠀⠀⠀⢠⣿⡇⠀⠀⠀⠀⣶⣶⣾⠿⠁
          ⠀⠀⠀⠉⣿⣇⡀⠀⣀⣾⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠉⠉⠙⠛⠛⠛⠛⠛⠛⠛⠉⠉⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⢿⣷⣄⠀⠀⣠⣿⠇⠀⠀⠀
          ⠀⠀⠀⠀⠈⠛⠿⠿⠿⠛⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠙⠻⠿⠿⠟⠋⠀⠀⠀⠀
        </pre>
      </div>
        <Container maxWidth='lg' style={{ paddingTop: 16, paddingBottom: 16 }}>
        <Paper elevation={1} style={{ padding: 12, marginBottom: 12 }}>
          <Stack spacing={1}>
            <Stack direction='row' spacing={1} alignItems='center' sx={{ flexWrap: 'wrap' }}>
              <TextField size='small' label='Collection Name' value={saveInputText} onChange={event => setSaveInputText(event.target.value)} />
              <Button variant='contained' onClick={() => saveCollection()}>Save</Button>
              <Button variant='outlined' color='warning' onClick={() => deleteCollection()}>Delete</Button>
              <Button variant='outlined' color='inherit' onClick={() => clearCollection()}>Clear</Button>
              <Divider flexItem orientation='vertical' />
              <InputLabel id="collection-label-id">Collection</InputLabel>
              <Select
                labelId='collection-label-id'
                label='Collection'
                placeholder='Collection'
                className='collectionNameDropdown'
                onChange={event => { setCurrentCollection(event.target.value); setCollectionNameDropdownOption(event.target.value); }}
                value={collectionNameDropdownOption}
                sx={{ minWidth: 180 }}
              >
                {getCollectionKeys().map(col => <MenuItem key={col} value={col}>{col}</MenuItem>)}
              </Select>
              <Button variant='outlined' onClick={() => { getCollection(currentCollection); }}>Load</Button>
            </Stack>
            <Stack direction='row' spacing={1} alignItems='center' sx={{ flexWrap: 'wrap' }}>
              <TextField size='small' label='Filter by name' value={cardNameFilterText} onChange={event => setCardFilterText(event.target.value)} />
              <ButtonGroup variant='contained'>
                <Button color={showCollectionState === VisibilityState.ALL_CARDS ? 'success' : 'inherit'} onClick={() => toggleShowCards(VisibilityState.ALL_CARDS)}>All</Button>
                <Button color={showCollectionState === VisibilityState.COLLECTED_CARDS ? 'success' : 'inherit'} onClick={() => toggleShowCards(VisibilityState.COLLECTED_CARDS)}>Collected</Button>
                <Button color={showCollectionState === VisibilityState.MISSING_CARDS ? 'success' : 'inherit'} onClick={() => toggleShowCards(VisibilityState.MISSING_CARDS)}>Missing</Button>
              </ButtonGroup>
              <ButtonGroup variant='outlined'>
                <Button variant={onlyAlts ? 'contained' : 'outlined'} onClick={() => toggleAlts()}>Only Alts</Button>
                <Button variant={noAlts ? 'contained' : 'outlined'} onClick={() => toggleNoAlts()}>No Alts</Button>
              </ButtonGroup>
              <InputLabel id='card-set-label-id'>Card Set</InputLabel>
              <Select
                labelId='card-set-label-id'
                label='Card Set'
                placeholder='Card Set'
                value={selectedSet}
                className='collectionNameDropdown'
                onChange={event => setSelectedSet(event.target.value)}
                sx={{ minWidth: 160 }}
              >
                {uniqueSets.map(set => <MenuItem key={set} value={set}>{set}</MenuItem>)}
              </Select>
              <TextField size='small' label='Bulk add qty' value={addCardsBulkInputText} onChange={event => setAddCardsBulkInputText(event.target.value)} style={{ width: 120 }} />
              <Button variant='outlined' onClick={() => addCardsBulk()}>Add to visible</Button>
              <Divider flexItem orientation='vertical' />
              <Button color='inherit' onClick={resetFilters}>Reset Filters</Button>
            </Stack>
          </Stack>
        </Paper>
        <CardMatrix
          cardAmount={collection}
          cardsData={filteredCards}
          callback={addReduceCardAmountWrapper}
          showControls={showControls}
          size={sizeToPx(gridSize)}
        />
        <Dialog open={showExportScreen} onClose={() => setShowExportScreen(false)} maxWidth='lg' fullWidth>
          <DialogTitle>Export Preview</DialogTitle>
          <DialogContent>
            <CardExportScreen
              cardAmount={collection}
              cardsData={getCollectedCards()}
              size={'min(180px, calc((100vw - 96px) / 5))'}
              columns={5}
              visible={true}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => copyExportText()}>Copy Text</Button>
            <Button variant='contained' onClick={() => saveExportPng()}>Save PNG</Button>
            <Button onClick={() => setShowExportScreen(false)}>Close</Button>
          </DialogActions>
        </Dialog>
        <Dialog open={showTagWorkbench} onClose={() => setShowTagWorkbench(false)} maxWidth='xl' fullWidth>
          <DialogTitle>Synergy Tag Editor v2</DialogTitle>
          <DialogContent dividers>
            <TagEditor />
          </DialogContent>
        </Dialog>
        <Dialog open={showSynergyViewer} onClose={() => setShowSynergyViewer(false)} maxWidth='xl' fullWidth>
          <DialogTitle>Synergy Viewer</DialogTitle>
          <DialogContent dividers>
            <SynergyGraphViewer height={720} />
          </DialogContent>
        </Dialog>
        {/* Hidden full-size export target for high-quality PNG capture */}
        <div style={{ position: 'absolute', left: -99999, top: -99999 }}>
          <CardExportScreen ref={exportRef}
            cardAmount={collection}
            cardsData={getCollectedCards()}
            size={'220px'}
            columns={5}
            visible={true}
          />
        </div>

        </Container >
        {showScrollTop && (
          <Fab color='primary' size='medium' onClick={scrollToTop} style={{ position: 'fixed', bottom: 24, right: 24 }} aria-label='scroll back to top'>
            <KeyboardArrowUpIcon />
          </Fab>
        )}
      </ThemeProvider>
    </>
  )
}

export default App
