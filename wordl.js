var word_length = 5;
var pairings = [];

const CORRECT = "G", INCORRECT = "B", WRONG_SPOT = "Y"; 
const NORMAL = 0, HARD = 1, BOTH = 2;
const NO_WORDS = "<div id = 'nowords'>it doesn't look like we have this word. double check to make sure you all the clues you entered are correct.</div>"
const STARTING_WORDS = "these are your best possible starting words:";
const BEST_GUESSES = "these are your best possible guesses:";
const LIST_SIZE = 10;
const GUESSES_ALLOWED = 6;
const NOT_CORRECT_AMOUNT = 0;
const NO_GREENS = 1;
const YELLOWS_IN_WRONG_SPOT = 2;
const NOT_IN_WORD = 3;
const CHECK_SIZE = 50;
const NOT_YET_TESTED = .999;
const MAX_TIME = 2000;

$(document).ready(function() {
    if (localStorage.getItem("word length")) {
        word_length = localStorage.getItem("word length");
        $("#num_letters").val(word_length);
    }

    if (localStorage.getItem("difficulty")) {
        $("#mode").prop('checked', true);
        swapSlides($('.best-guesses.normal'), $('.best-guesses.hard'), true)
    }
    
    setLength();
    makeTables();
    update();

    $("#refresh").click(function() {
        $("#grid").empty();
        $("#calculate").empty();
        update();
    });

    $("#wordlebot").click(function() {
        testStartingWords();
    });

    $("#num_letters").on('input', function() {
        setLength();
        removeTest();
        makeTables();
        update();

        localStorage.setItem("word length", word_length);
    });

    $("#wordbank").on('input', function() {
        setWordbank();
        update();
    });

    $("#mode").on('input', function() {
        swapSlides($(".best-guesses.normal"), $(".best-guesses.hard"), $(this).is(':checked'));
    });
    
    $("#word_entered").on('input', function(e) {
        let val = $("#word_entered").val();
        if (words.includes(val)) {
            $("#word_entered").blur();
            
            makeTables(val);
            
            if (word_length == 11) {
                $(".tile").css('font-size', '1rem');
            }
        } 
    });

    $(document).on('click', '.tile', function(e) {
        e.preventDefault();
        changeTileColor($(this));
    });

    $(document).on('click', '.filter', function() {
        update();
    });

    $(document).on('click', '.undo', function() {
        $(".row:last").remove();

        if (!$(".tile").length) {
            $("#calculate").empty();
        }
        update();
    });

    $(document).on('click', '.test', function() {
        setupTest();
    });

    $(document).on('click', '.showlist', function() {
        if ($(this).children().hasClass("visible")) {
            ($(this).children().removeClass("visible"));
        } else {
            $(this).children().addClass("visible");
        }

    });
});

function swapSlides(normal_slides, hard_slides, hard_mode) {
    let norm_pos = getSlidePosition(normal_slides);
    let hard_pos = norm_pos == 'front' ? 'back' : 'front';

    normal_slides[0].classList.replace(norm_pos, hard_pos);
    hard_slides[0].classList.replace(hard_pos, norm_pos);

    hard_mode ? localStorage.setItem('difficulty', true) : localStorage.removeItem('difficulty');
}

function getSlidePosition(slide) {
    return Array.from(slide[0].classList).filter(a => a == 'back' || a == 'front');
}

function addButtons() {
    let buttons = "<button class = 'filter'>calculate next guess</button>"
        buttons += "<button class = 'undo'>remove last guess</button>"

    document.getElementById("calculate").innerHTML += buttons;
}

function makeTables(val, c) {
    if (c == null) c = "normal";
    if (!words.includes(val)) return;

    if (val) {
        let row = "<div class = 'row'>"
        
        for (let i = 0; i < word_length; i++) {
            row += "<button class = 'B tile " + c + "'>" + val[i] + "</button>"
        }
        row += "</div>"
        document.getElementById("grid").innerHTML += row;
    }

    if (numberOfGuessesSoFar(1) && c == 'normal') {
        addButtons();
    }

    document.getElementById("word_entered").value = "";
}

function changeTileColor(tile) {
    let old_color = getTileColor(tile);
    let new_color = nextColor(old_color);
    tile[0].classList.replace(old_color, new_color);
}

function getTileColor(tile) {
    return Array.from(tile[0].classList).filter(a => a == CORRECT || a == INCORRECT || a == WRONG_SPOT);
}

function nextColor(color) {
    return color == CORRECT ? WRONG_SPOT : (color == WRONG_SPOT ? INCORRECT : CORRECT)
}

function setLength() {
    word_length = document.getElementById("num_letters").value;

    document.getElementById('word_entered').setAttribute('maxlength', word_length); 
    document.getElementById('word_entered').value = "";
    document.getElementById('grid').innerHTML = "";
    document.getElementsByTagName('calculate').innerHTML = "";

    setWordbank();
    words = big_list.filter((a) =>  a.length == word_length);
}

function setWordbank() {
    wordbank = document.getElementById("wordbank").value;

    if (wordbank == 'restricted') {
        if (word_length == 5) {
            common = common_words.filter(a => a.game == 'official' || a.game == 'quordle');
        } else {
            common = common_words.filter(a => a.game != 'unlimited');
        }
    } else {
        common = common_words.slice();
    }

    common = common.map(a => a.word);
    common = common.filter(a => a.length == word_length);
    common = [...new Set(common)];
    common = common.sort();

    for (let i = 0; i < easy.length; i++) {
        if (easy[i][wordbank] != null) {
            easy[i].average = easy[i][wordbank].average;
            easy[i].wrong = easy[i][wordbank].wrong;
        } else {
            easy[i].average = null;
            easy[i].wrong = NOT_YET_TESTED;
        }
    }

    for (let i = 0; i < hard.length; i++) {
        if (hard[i][wordbank] != null) {
            hard[i].average = hard[i][wordbank].average;
            hard[i].wrong = hard[i][wordbank].wrong;
        } else {
            hard[i].average = null;
            hard[i].wrong = NOT_YET_TESTED;
        }
    }
}

function filterList(list, letters) {
    if (!letters.length) return list;
    let restrictions = determineLetterPositions(letters);

    list = removeIf(list, restrictions, NOT_CORRECT_AMOUNT);
    list = removeIf(list, restrictions, NO_GREENS);
    list = removeIf(list, restrictions, YELLOWS_IN_WRONG_SPOT);

    return list;
}

function removeIf(list, restrictions, condition) {
    for (let i = 0; i < list.length; i++) {
        for (char in restrictions) {
            if (isTrue(list[i], restrictions[char], char, condition)) {
                list.splice(i, 1);
                i--;
                break;
            }
        }
    }

    return list;
}

function isTrue(word, restrictions, char, condition) {
    if (condition == NOT_CORRECT_AMOUNT) {
        let freq = count(word, char);
        return freq > restrictions.max || freq < restrictions.min
    }

    if (condition == NO_GREENS) {
        let correct_positions = restrictions[CORRECT];
        return correct_positions.some(a => word.charAt(a) != char);
    }

    if (condition == YELLOWS_IN_WRONG_SPOT) {
        let wrong_positions = restrictions[WRONG_SPOT];
        return wrong_positions.some(a => word.charAt(a) == char);
    }

    if (condition == NOT_IN_WORD) {
        return word.includes(char) && restrictions.max == 0;
    }
}

function determineLetterPositions(letters) {
    let letter_positions = determineCorrectLetters({}, letters, letters[0], letters[0].innerHTML, 0, 0);
    letter_positions = determineIncorrectLetters(letter_positions, letters, letters[0], letters[0].innerHTML, 0, 0, [], []);

    return letter_positions;
}

function determineCorrectLetters(letter_positions, letters, tile, char, position, index) {
    if (letter_positions[char] == null) {
        letter_positions[char] = {[CORRECT]: [], [WRONG_SPOT]: [], min: 0, max: 5};
    }
    
    if (tile.classList.contains(CORRECT)) {
        if (!letter_positions[char][CORRECT].includes(position)) {
            letter_positions[char][CORRECT].push(position);
            letter_positions[char].min++;
        }
    }
    
    if (index >= letters.length - 1) return letter_positions;
    else return determineCorrectLetters(letter_positions, letters, letters[index+1], letters[index+1].innerHTML, (index+1)%word_length, index+1);
}

function determineIncorrectLetters(letter_positions, letters, tile, char, position, index, count, exclude) {
    if (tile.classList.contains(WRONG_SPOT) || tile.classList.contains(INCORRECT)) {
        if (!letter_positions[char][WRONG_SPOT].includes(position)) {
            letter_positions[char][WRONG_SPOT].push(position);
        }

        if (tile.classList.contains(INCORRECT)) exclude[char] = true;
    }

    if (tile.classList.contains(WRONG_SPOT) || tile.classList.contains(CORRECT)) {
        if (count[char]) count[char]++;
        else count[char] = 1;
    }

    if (position == word_length-1) {
        letter_positions = adjustMinAndMax(letter_positions, count, exclude);
        count = [];
        exclude = [];
    }    

    if (index >= letters.length - 1) return letter_positions;
    else return determineIncorrectLetters(letter_positions, letters, letters[index+1], letters[index+1].innerHTML, (index+1)%word_length, index+1, count, exclude);
}

function adjustMinAndMax(letter_positions, count, exclude) {
    Object.keys(count).forEach(function(key) {
        letter_positions[key].min = Math.max(letter_positions[key].min, count[key]);
    });

    Object.keys(exclude).forEach(function(key) {
        if (count[key]) {
            letter_positions[key].max = Math.min(letter_positions[key].max, count[key]);
        } else {
            letter_positions[key].max = 0;
        }
    });

    return letter_positions;
}

function updateHeaders(words_left, likely_answers, unlikely_answers) {
    let heading = document.getElementsByClassName("num_options")[0];
    let subheading = document.getElementsByClassName("by_likelihood")[0];

    heading.innerHTML = words_left.length + " possible word" + ((words_left.length > 1) ? "s" : "");
    subheading.innerHTML = "<span class = 'showlist'><div></div>" + likely_answers.length + " probable answer" + ((likely_answers.length != 1) ? "s" : "") + "</span>, " 
                        + "<span class = 'showlist'><div></div>" + unlikely_answers.length + " unlikely possibilit" + ((unlikely_answers.length != 1) ? "ies" : "y") + "</span>.";
}

function getTileColors() {
    let tiles = document.getElementsByClassName("tile");
    let coloring = "";

    for (let i = Math.max(0, tiles.length - word_length); i < tiles.length; i++) {
        coloring += Array.from(tiles[i].classList)[0];
    }

    return coloring;
}

function guessesArePrecomputed(difficulty) {
    if (numberOfGuessesSoFar(1)) {
        let diff = getTileColors();
        let word = getWord(1);
        let hash = makeHash(wordbank, difficulty, diff)

        if (seconds[word] != null) {
            if (seconds[word][hash] != null) {
                return seconds[word][hash];
            }
        } else seconds[word] = {};
    }

    return 0;
}

function makeHash(list_type, difficulty, string) {
    return list_type + "/" + difficulty + "/" + string;
}

function setBestGuesses(best_guesses, difficulty) {
    let diff = getTileColors();
    let word = getWord(1);
    let hash = makeHash(wordbank, difficulty, diff)

    seconds[word][hash] = best_guesses.slice(0, LIST_SIZE);
}

function numberOfGuessesSoFar(number) {
    return parseInt(document.getElementsByClassName("tile").length/5) == number;
}

function writeBestGuessList(guesses, list_length) {
    let data, list = "";
    for (let i = 0; i < list_length && i < guesses.length; i++) {
        if (guesses[i].wrong > 0 && guesses[i].wrong != NOT_YET_TESTED) {
            data = guesses[i].average.toFixed(3) + " guesses, "
            + ((1 - guesses[i].wrong)*100).toFixed(2) + "% solve rate.";
        } else if (guesses[i].wrong == NOT_YET_TESTED) {
            data = "not yet tested ";
        }
        else data = guesses[i].average.toFixed(3) + " guesses to solve.";

        let word = "<div class = 'suggestion'>" + guesses[i].word + ": </div>";
        let score = "<div class = 'score'>" + data + "</div>";
        list += "<li>" + word + score + "</li>";
    }

    return list;
}

function isDifficulty(mode, check) {
    return mode == check;
}

function updateLists(words_left, likely_answers, unlikely_answers, normal_guesses, hard_guesses) {
    let list_length = Math.min(likely_answers.length, LIST_SIZE);
    let normal_list = writeBestGuessList(normal_guesses, list_length, NORMAL);
    let hard_list = writeBestGuessList(hard_guesses, list_length, HARD);
    
    updateHeaders(words_left, likely_answers, unlikely_answers);
    addToSlides(BEST_GUESSES, normal_list, hard_list)
    createAnswerDropdown(likely_answers, unlikely_answers);
    
    if (likely_answers.length <= 2) {
        return showFinalOptions(likely_answers, unlikely_answers);
    }
}

function createAnswerDropdown(likely_answers, unlikely_answers) {
    let word_lists = document.getElementsByClassName("showlist");
    let potential_answers = word_lists[0].getElementsByTagName("div")[0];
    let technically_words = word_lists[1].getElementsByTagName("div")[0];
    let likely_list = unlikely_list = "";

    for (let i = 0; i < likely_answers.length; i++) {
        likely_list += likely_answers[i] + "<br>";
    }
    potential_answers.innerHTML = "<p>" + likely_list + "</p>";

    for (let i = 0; i < unlikely_answers.length; i++) {
        unlikely_list += unlikely_answers[i] + "<br>";
    }
    technically_words.innerHTML = "<p>" + unlikely_list + "</p>";
}

function addToSlides(heading, normal_suggestions, hard_suggestions) {
    document.getElementsByClassName("best_options")[0].innerHTML = heading;
    document.getElementsByClassName("best-guesses normal")[0].getElementsByTagName("ul")[0].innerHTML = normal_suggestions;
    document.getElementsByClassName("best-guesses hard")[0].getElementsByTagName("ul")[0].innerHTML = hard_suggestions;
}

function showFinalOptions(sorted, less_likely) {
    if (!sorted.length && !less_likely.length) {
        return addToSlides("", NO_WORDS, NO_WORDS);
    }   

    let final_words = "";
    if (sorted.length) {
        final_words += "<li class = 'likely'>the word is almost certainly ";

        if (sorted.length == 2) {
            final_words += "<span class = 'final'>" + sorted[0] + "</span> or <span class = 'final'>" + sorted[1] + "<span></li>";
        }

        else {
            final_words += "<span class = 'final'>" + sorted[0] + "</span></li>";
        }
    }

    if (less_likely.length) {
        final_words += "<li class = 'others'>Unlikely, but it might be ";

        for (let i = 0; i < less_likely.length; i++) {
            final_words += "<span class = 'final'>" + less_likely[i] + "</span>";

            if (i < less_likely.length - 1) final_words += ", ";
            else final_words += "."
        } 

        final_words += "</li>";
    }

    addToSlides("", final_words, final_words);
}

function bestLetters(list) {
    if (!list.length) return [];

    let alphabet = [];

    for (let c = 65; c <= 90; c++) {
        alphabet[String.fromCharCode(c)] = [];
        for (let i = 0; i < word_length+1; i++) {
            alphabet[String.fromCharCode(c)].push(0);
        }
    }

    let checked;

    for (let i = 0; i < list.length; i++) {
        checked = [];
        for (let j = 0; j < word_length; j++) {
            c = list[i].charAt(j);

            alphabet[c][j]++;

            if (checked[c] != true) alphabet[c][word_length]++;  // only counts letters once per word
            checked[c] = true;
        }
    }

    return alphabet;
}

function updateLetterList(alphabet, list_size) {
    let letters_ranked = [];

    for (let i = 0; i < 26; i++) {
        letters_ranked.push({letter:String.fromCharCode(i+65), score:alphabet[String.fromCharCode(i+65)][word_length]});
    }

    letters_ranked.sort((a, b) => (a.score <= b.score) ? 1 : -1);

    document.getElementsByClassName('best-letters')[0].innerHTML = "";
    let most_frequent = 0;

    for (let c = 0; c < 26; c++) {
        let freq = parseFloat(letters_ranked[c].score/list_size*100).toFixed(2);
        let letter = "<div class = 'letter-ranking'><div class = 'letter'>" + letters_ranked[c].letter + "</div>";
        let score = "<div class = 'frequency'>" + freq + "%</div></div>";

        if (freq == 0) {
            break;
        } else document.getElementsByClassName('best-letters')[0].innerHTML += "<li>" + letter + score + "</li>";
        
        if (freq != 100) {
            let red = 0 * (freq/100 / (letters_ranked[most_frequent].score/list_size));
            let green = 0 * (freq/100 / (letters_ranked[most_frequent].score/list_size));
            let blue = 200 * (freq/100 / (letters_ranked[most_frequent].score/list_size));
            
            document.getElementsByClassName('letter-ranking')[c].style.backgroundColor = "rgb(" + red + ", " + green + ", " + blue + ")";
        } else {
            most_frequent++;
        }        
    }
}

function sortList(list, alphabet, sorted_list) {
    if (!list.length) return [];

    let newranks = [];

    list.forEach(function(w) {
        newranks.push({word: w, rank: 0});
    });

    checked = [];

    for (let i = 0; i < newranks.length; i++) {
        for (let j = 0; j < word_length; j++) {
            if (sorted_list != null) {
                if (alphabet[newranks[i].word.charAt(j)][word_length] == sorted_list.length) continue;
            }

            if (checked[i + " " + newranks[i].word.charAt(j)] == true) continue;  //no extra credit to letters with doubles
            newranks[i].rank += alphabet[newranks[i].word.charAt(j)][word_length];
            checked[i + " " + newranks[i].word.charAt(j)] = true;
        }
    }
        
    newranks.sort((a, b) => (a.rank <= b.rank) ? 1 : -1);

    return newranks;
}

function reduceListSize(guesses, answers) {
    if (answers.length > 10) { 
        let letters = document.getElementsByClassName("tile");
        letter_restrictions = determineLetterPositions(letters);
        guesses = removeUselessGuesses(guesses, letter_restrictions);
    } 
    
    guesses = sortList(guesses, bestLetters(answers), answers).map(a => a.word);
    return guesses;
}

function removeUselessGuesses(list, restrictions) {
    if (!list.length) return [];

    list = removeIf(list, restrictions, NOT_IN_WORD);
    list = removeIf(list, restrictions, YELLOWS_IN_WRONG_SPOT);
    return list;    
}

function update() {
    let uncommon = false;
    let letters = document.getElementsByClassName("tile");
    let answer_list = filterList(common.slice(), letters);
    let all_possible_words = filterList(words.slice(), letters);
    let unlikely_answers = all_possible_words.filter(a => !answer_list.some(b => b == a));

    if (!answer_list.length) {
        answer_list = all_possible_words.slice();
        uncommon = true;
    }

    if (!answer_list.length) {
        return showFinalOptions([], [])
    }

    let alphabet = bestLetters(answer_list);
    let sorted_answer_list = sortList(answer_list, alphabet).map(a => a.word);
    let sorted_guess_list = sortList(words.slice(), alphabet, sorted_answer_list).map(a => a.word);
    let guesses = getBestGuesses(sorted_answer_list, sorted_guess_list, all_possible_words);

    if (uncommon) {
        sorted_answer_list = [];
    }
    
    updateLetterList(alphabet, answer_list.length);
    updateLists(all_possible_words, sorted_answer_list, unlikely_answers, guesses.normal, guesses.hard);
}

function getBestGuesses(answer_list, guess_list, all_possible_words, difficulty) {
    let best_guesses = {normal: guessesArePrecomputed(NORMAL), hard: guessesArePrecomputed(HARD)};

    if (best_guesses.normal && isDifficulty(NORMAL, difficulty)) return best_guesses.normal;
    if (best_guesses.hard && isDifficulty(HARD, difficulty)) return best_guesses.hard;
    if (best_guesses.normal && best_guesses.hard) return best_guesses;

    if (numberOfGuessesSoFar(0)) {
        best_guesses = getFirstGuesses();
        return {normal: sortGroupsByAverage(best_guesses.normal), hard: sortGroupsByAverage(best_guesses.hard)};
    }

    let words_to_check = getWordsToCheck(answer_list, guess_list);
    if (isDifficulty(HARD, difficulty)) words_to_check = all_possible_words.slice();

    let initial_guesses = reducesListMost(answer_list, words_to_check);
    let initial_hard_guesses = initial_guesses.map(a => Object.assign({}, a)).filter(a => all_possible_words.includes(a.word));

    if (!isDifficulty(HARD, difficulty) && !best_guesses.normal) {
        best_guesses.normal = calculateGuessList(answer_list, guess_list, initial_guesses.slice(0, CHECK_SIZE));
        best_guesses.normal = sortGroupsByAverage(best_guesses.normal).slice(0, LIST_SIZE);
        setBestGuesses(best_guesses.normal, NORMAL);
    }

    if (!best_guesses.hard && !isDifficulty(NORMAL, difficulty)) {
        best_guesses.hard = calculateGuessList(answer_list, all_possible_words, initial_hard_guesses.slice(0, CHECK_SIZE), HARD);
        best_guesses.hard = sortGroupsByAverage(best_guesses.hard).slice(0, LIST_SIZE);  
        setBestGuesses(best_guesses.hard, HARD);
    } 
    
    if (isDifficulty(HARD, difficulty)) return best_guesses.hard;
    if (isDifficulty(NORMAL, difficulty)) return best_guesses.normal;

    return best_guesses;
}

function getFirstGuesses(answers_left, possible_guesses, difficulty) {
    return {normal: easy.filter(a => a.word.length == word_length).sort((a, b) => a.wrong >= b.wrong ? 1 : -1), 
            hard: hard.filter(a => a.word.length == word_length).sort((a, b) => a.wrong >= b.wrong ? 1 : -1)}
}

function getWordsToCheck(filtered, full_list) {
    full_list = reduceListSize(full_list, filtered);
    let check_list = filtered.concat(full_list);
    check_list = [...new Set(check_list)]; 

    return check_list;
}

function calculateGuessList(answers, guesses, best_words, difficulty) {
    guesses_left = GUESSES_ALLOWED - (document.getElementsByClassName("tile").length/word_length);

    const start_time = performance.now();
    for (let i = 0; i < CHECK_SIZE && i < best_words.length; i++) {
        let remaining = best_words[i].differences;
        let results = new Array(guesses_left).fill(0);
        results.push(answers.length);
        
        Object.keys(remaining).forEach(function(key) {
            countResults(best_words[i], remaining[key], guesses, results, 0, difficulty, key)
        });

        best_words[i].wrong = best_words[i].results[results.length - 1]/answers.length;
        // console.log(i + " --> " + (performance.now() - start_time));
        if (performance.now() - start_time > MAX_TIME) {
            if (numberOfGuessesSoFar(1)) console.log("calculated " + i + " words");

            best_words = best_words.slice(0, i+1);
            break;
        }
    }
    best_words.sort((a, b) => a.wrong >= b.wrong ? 1 : -1);
    return best_words.map(a => Object.assign( {}, {word: a.word, average: a.average, wrong: a.wrong}));
}

function sortGroupsByAverage(guesses) {
    let best = [];

    for (let i = 0; i < guesses.length; i++) {
        let wrong = guesses[i].wrong;
        if (best[wrong] == null) {
            best[wrong] = [];
        }

        best[wrong].push(guesses[i]);
    }

    let final = [];
    Object.keys(best).forEach(function(key) {
        let subgroup = best[key].sort((a, b) => a.average >= b.average ? 1 : -1);
        final = final.concat(subgroup)
    });

    return final;
}

function createLetterTiles(word, coloring) {
    let board = document.getElementsByClassName("tile");
    let letters = [];

    for (let i = 0; i < board.length; i++) {
        letters.push(board[i]);
    }

    for (let i = 0; i < word.length; i++) {
        let tile = document.createElement("button");
        tile.classList.add(coloring.charAt(i));
        tile.innerHTML = word.charAt(i);

        letters.push(tile);
    }

    return letters;
}

function countResults(best, answers, guesses, results, attempt, difficulty, differences) {
    if (answers.length <= 2) {
        if (answers.length == 0) {
            results[attempt]++;
            results[results.length-1]--;
        }  
        
        if (answers.length <= 2 && answers.length != 0 && attempt < results.length - 1) {
            results[attempt+1]++;
            results[results.length-1]--;
        }

        if (answers.length == 2 && attempt < results.length - 2) {
            results[attempt+2]++;
            results[results.length-1]--;
        } 
    } else if (attempt <= 3) {
        let new_guesses = answers.concat(guesses);
        new_guesses = [...new Set(new_guesses)];

        let letters = createLetterTiles(best.word, differences);

        if (isDifficulty(HARD, difficulty)) {
            new_guesses = filterList(new_guesses, letters);
        }

        let best_words = reducesListMost(answers, new_guesses, true);
        let remaining = best_words[0].differences;

        Object.keys(remaining).forEach(function(key) {
            countResults(best_words[0], remaining[key], new_guesses, results, attempt+1, difficulty, key);
        });
    }

    let avg = 0;
    let sum = 0;
    for (let i = 0; i < results.length; i++) {
        sum += results[i];
        avg += results[i]*(i+1);
    }

    best.results = results;
    
    avg = avg/sum;
    best.average = avg;
}

const FACTOR = 1.5;
function reducesListMost(answers, guesses, futureGuess) {
    let best_words = [];
    let list_size = answers.length;
    let min = answers.length;

    outer:
    for (let pos = 0; pos < guesses.length; pos++) {
        let differences = [];
        let compare = guesses[pos];
        let weighted = 0;

        for (let i = 0; i < answers.length; i++) {
            let s = answers[i];
            let diff = getDifference(compare, s); 

            if (differences[diff] == null) {
                differences[diff] = [];
            }

            if (diff != CORRECT.repeat(word_length)) {
                differences[diff].push(s);
            }

            let freq = differences[diff].length;
            
            if (freq > 0) {
                weighted += (freq/list_size)*freq - ((freq-1)/list_size)*(freq-1);
                // if (weighted > FACTOR*min) {
                //     continue outer;
                // }
            }
        }

        min = Math.min(min, weighted);

        let threes = 0;
        Object.keys(differences).forEach(function(key) {
            if (differences[key].length == 0) {
                threes += 1/answers.length;
            } else {
                threes += 1/answers.length*1/differences[key].length;
            }
        });

        threes = Math.min(1, threes);
        let adjusted = (1-threes)*weighted;

        best_words.push({word: compare, adjusted: adjusted, differences: differences, 
                        results: null, average: null, wrong: null});
        
        if (weighted < 1 && futureGuess) break;
        if (weighted == 1 && pos >= answers.length && futureGuess) break;
    }

    best_words.sort((a, b) => a.adjusted >= b.adjusted ? 1 : -1);
    return best_words;
}

function getDifference(word1, word2) {
    if (pairings[word1] != null) {
        if (pairings[word1][word2] != null) {
            return pairings[word1][word2];
        }
    }

    let diff = ""

    for (let j = 0; j < word_length; j++) {
        if (word1.charAt(j) == word2.charAt(j)) {
            diff += CORRECT;
        } else if (!word2.includes(word1.charAt(j))) {
            diff += INCORRECT;
        } else {
            let c = word1.charAt(j);

            if (count(word1, c) <= count(word2, c)) {
                diff += WRONG_SPOT;
            } else {
                diff += compareDoubles(word1, word2, c, j);
            }
        }
    }

    if (pairings[word1] != null) {
        pairings[word1][word2] = diff;
    } else {
        pairings[word1] = [];
        pairings[word1][word2] = diff;
    }

    return diff;
}

// pos is the position in the word the character is (ie: pos is 2 for 'a' and trap)
// place = is the spot in the indicies list that position is (ie: place = 1 for 'a' and 'aroma', a_list = [0, 4], and pos == 4)
function compareDoubles(a, b, char, pos) {
    let a_list = getSpots(a, char);
    let b_list = getSpots(b, char);

    for (let i = 0; i < a_list.length; i++) {
        if (b_list.includes(a_list[i])) {
            let index = b_list.indexOf(a_list[i]);
            b_list.splice(index, 1);

            a_list.splice(i, 1);
            i--;
        }

        if (b_list.length == 0) {
            return INCORRECT;
        }
    }

    for (let i = 0; i < a_list.length; i++) {
        if (pos == a_list[i])  {
            return WRONG_SPOT;
        }

        a_list.splice(i, 1);
        b_list.splice(i, 1);
        i--;

        if (b_list.length == 0) return INCORRECT;
    }

    return INCORRECT;
}

function getSpots(string, char) {
    indicies = [];
    
    for (let i = 0; i < string.length; i++) {
        if (string[i] == char) indicies.push(i);
    }

    return indicies;
}

function count(string, char) {
    let count = 0;

    for (let i = 0; i < string.length; i++) {
        if (string[i] == char) count++;
    }

    return count;
}