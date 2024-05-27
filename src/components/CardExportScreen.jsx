import React from "react";
import Card from "./Card";
import '../styles/CardExportScreen.css';
import CardWithControls from "./CardWithControls";

const IMAGE_PATH = '/src/assets/cards/';

export default class CardExportScreen extends React.Component {
    constructor(props) {
        super(props);
    }
    render() {
        return <div className="cardScreenContainer">
            {Object.keys(this.props.cardsData).map((key, _) =>
                <CardWithControls
                    showAmount={true}
                    showControls={false}
                    uri={`${IMAGE_PATH}/${this.props.cardsData[key].cardSetCode}/${this.props.cardsData[key].parallelId}.png`}
                    callback={() => { }}
                    size="100px"
                    key={this.props.cardsData[key].parallelId}
                    amount={this.props.cardAmount[key] ?? 0}
                    cardId={key}
                />
            )}
        </div>
    }
}