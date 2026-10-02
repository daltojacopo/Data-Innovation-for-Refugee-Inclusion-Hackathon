# An Algorithm in the Loop - K Mazzu

## The dashboard

A static dashboard mockup for the Cashy Oversight Challenge. Open `index.html` in a browser; the case data is loaded from `data/demo-cases.js`, so the prototype does not require a server or a database.

The dashboard aim at simulating a real world scenario in which a UNHCR caseworker has to evaluate the situation of an household requesting for cash assistence. 
The center, and main, part of the dashboard is focused on showing clearly and cleverly the situation to the caseworker: in order to achieve it an AI model is used to highlight the important and decision-shifting variables.
In particular, an overall of the situation is shown, such as vulnerability score, household size and whether administrative checks are showing something on the record.

Below, the variables are ordered following the importance found by the AI model, and it is shown the household values. 
If the model sense a particularly severe situation, a red flag is shown. 
It is also present a link to access the interview data, when the caseworker sense it may be useful. 

On the bottom a box let the human takes the decision, to grant or not the cash assistence to the household. 

The K_Mazzu_alg.pynb contains all the coding that we have done to simulate the pipeline. In particular we used the AutoGluon 
