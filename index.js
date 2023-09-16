const express = require("express");
const OpenAI = require("openai");
require("dotenv").config();
const db = require("./db");

const OPENAI_API_KEY = process.env.OPENAI_API;
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const PORT = process.env.PORT || 3000;

const locations = {
  "Federal Territory of Kuala Lumpur": "Kuala Lumpur",
};

const defaultFallbackResponse = [
  {
    payload: {
      richContent: [
        [
          {
            type: "description",
            title:
              "Oops! It seems I didn't quite understand your request. No worries, though! If you have any questions or need assistance with anything related to your travel plans, feel free to get in touch with us.",
            text: [
              "Address: 601 Macpherson Road #01-08A, Grantral Mall @ Macpherson, Singapore 368242",
              "Email: enquiry@transtar.travel",
              "Phone: +65 6295 9009",
              "Our friendly team is here to assist you with any inquiries you may have. Don't hesitate to reach out, and we'll be happy to help you! 😊",
            ],
          },
        ],
      ],
    },
  },
];

// SERVER
const app = express();

app.listen(PORT, () => {
  console.log(`Server is up and running at ${PORT}`);
});

// MIDDLEWARES
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ROUTES
const getOneWayTrips = async (response) => {
  return new Promise((resolve, reject) => {
    let date;
    const outputContext = response?.outputContexts?.[0];

    const pickupLocation =
      locations?.[outputContext?.parameters?.pickup_location] ||
      outputContext?.parameters?.pickup_location;
    const pickupLocationByUser =
      outputContext?.parameters?.["pickup_location.original"];
    const dropLocation =
      locations?.[outputContext?.parameters?.drop_location] ||
      outputContext?.parameters?.drop_location;
    const dropLocationByUser =
      outputContext?.parameters?.["drop_location.original"];
    const journeyDate = outputContext?.parameters?.journey_date;
    const journeyDateByUser =
      outputContext?.parameters?.["journey_date.original"];

    if (journeyDate) {
      date = journeyDate?.split("T")[0];
    }

    if (!pickupLocation || !dropLocation || !journeyDate) {
      const response = {
        fulfillmentText:
          "I apologize, but I couldn't understand your request. Could you please rephrase or provide more details?",
      };
      resolve(response);
    }

    try {
      db.query(
        `
        SELECT startdate, enddate, pick_location.name AS pickup_location, drop_location.name AS drop_location 
        FROM trips
        LEFT JOIN locations AS pick_location ON pick_location.id = trips.pick_location_id
        LEFT JOIN locations AS drop_location ON drop_location.id = trips.drop_location_id
        WHERE trips.status = '1' 
        AND trips.deleted_at IS NULL
        AND trips.startdate >= CURDATE()
        AND LOWER(pick_location.name) = '${pickupLocation?.toLowerCase()}'
        AND LOWER(drop_location.name) = '${dropLocation?.toLowerCase()}'
        AND DATE_FORMAT(trips.startdate, '%Y-%m-%d') = '${date}'
        `,

        (error, results) => {
          if (error) {
            console.error("ERROR IN GETONEWAYTRIPS:", error);
            const response = {
              fulfillmentMessages: defaultFallbackResponse,
            };
            reject(response);
          }

          if (results?.length > 0) {
            const trips = [];
            results.map((trip) => {
              trips.push({
                type: "description",
                title: `${trip?.pickup_location} - ${trip?.drop_location}`,
                text: [
                  `
                Start Date: ${new Date(trip?.startdate).toLocaleString()} - 
                End Date: ${new Date(trip?.enddate).toLocaleString()}
                `,
                ],
              });
            });

            const availableTrips = [
              {
                payload: {
                  richContent: [trips],
                },
              },
            ];

            const response = {
              fulfillmentMessages: availableTrips,
            };

            resolve(response);
          } else {
            const response = {
              fulfillmentText: `Sorry, No trips available from ${pickupLocationByUser} to ${dropLocationByUser} on ${journeyDateByUser}.`,
            };
            resolve(response);
          }
        }
      );
    } catch (error) {
      console.error("ERROR IN GETONEWAYTRIPS:", error);
      const response = {
        fulfillmentMessages: defaultFallbackResponse,
      };
      reject(response);
    }
  });
};

const getTripsList = async (pickupLocation, dropLocation, date) => {
  return new Promise((resolve, reject) => {
    try {
      db.query(
        `
        SELECT startdate, enddate, pick_location.name AS pickup_location, drop_location.name AS drop_location
        FROM trips
        LEFT JOIN locations AS pick_location ON pick_location.id = trips.pick_location_id
        LEFT JOIN locations AS drop_location ON drop_location.id = trips.drop_location_id
        WHERE trips.status = '1'
        AND trips.deleted_at IS NULL
        AND trips.startdate >= CURDATE()
        AND LOWER(pick_location.name) = '${pickupLocation?.toLowerCase()}'
        AND LOWER(drop_location.name) = '${dropLocation?.toLowerCase()}'
        AND DATE_FORMAT(trips.startdate, '%Y-%m-%d') = '${date}'
      `,
        (error, results) => {
          if (error) {
            console.error("ERROR IN GETTRIPSLIST:", error);
            const response = {
              fulfillmentMessages: defaultFallbackResponse,
            };
            reject(response);
          } else {
            resolve(results);
          }
        }
      );
    } catch (error) {
      console.error("ERROR IN GETTRIPLIST", error);
    }
  });
};

const getReturnTripsList = async (pickupLocation, dropLocation, returnDate) => {
  return new Promise((resolve, reject) => {
    try {
      db.query(
        `
        SELECT startdate, enddate, pick_location.name AS pickup_location, drop_location.name AS drop_location
        FROM trips
        LEFT JOIN locations AS pick_location ON pick_location.id = trips.pick_location_id
        LEFT JOIN locations AS drop_location ON drop_location.id = trips.drop_location_id
        WHERE trips.status = '1'
        AND trips.deleted_at IS NULL
        AND trips.startdate >= CURDATE()
        AND LOWER(pick_location.name) = '${dropLocation?.toLowerCase()}'
        AND LOWER(drop_location.name) = '${pickupLocation?.toLowerCase()}'
        AND DATE_FORMAT(trips.startdate, '%Y-%m-%d') = '${returnDate}'
      `,
        (error, results) => {
          if (error) {
            console.error("ERROR IN GETRETURNTRIPSLIST:", error);
            const response = {
              fulfillmentMessages: defaultFallbackResponse,
            };
            reject(response);
          } else {
            resolve(results);
          }
        }
      );
    } catch (error) {
      console.error("ERROR IN GETRETURNTRIPLIST", error);
    }
  });
};

const getReturnTrips = async (response) => {
  return new Promise(async (resolve, reject) => {
    let date, returnDate;
    const outputContext = response?.outputContexts?.[0];
    const pickupLocation =
      locations[outputContext?.parameters?.pickup_location] ||
      outputContext?.parameters?.pickup_location;
    const pickupLocationByUser =
      outputContext?.parameters?.["pickup_location.original"];
    const dropLocation =
      locations[outputContext?.parameters?.drop_location] ||
      outputContext?.parameters?.drop_location;
    const dropLocationByUser =
      outputContext?.parameters?.["drop_location.original"];
    const journeyDate = outputContext?.parameters?.journey_date;
    const journeyDateByUser =
      outputContext?.parameters?.["journey_date.original"];
    const returnJourneyDate = outputContext?.parameters?.return_journey_date;
    const returnJourneyDateByUser =
      outputContext?.parameters?.["return_journey_date.original"];

    if (journeyDate) {
      date = journeyDate?.split("T")[0];
    }
    if (returnJourneyDate) {
      returnDate = returnJourneyDate?.split("T")[0];
    }

    if (!pickupLocation || !dropLocation || !date || !returnDate) {
      const response = {
        fulfillmentText:
          "I apologize, but I couldn't understand your request. Could you please rephrase or provide more details?",
      };
      resolve(response);
    }

    try {
      const tripList = await getTripsList(pickupLocation, dropLocation, date);
      const returnTripList = await getReturnTripsList(
        pickupLocation,
        dropLocation,
        returnDate
      );

      if (tripList?.length > 0 && returnTripList?.length > 0) {
        const availableTrips = [
          {
            payload: {
              richContent: [
                [
                  {
                    type: "description",
                    title: `${pickupLocation} - ${dropLocation}`,
                    text: [
                      `
                      Journey Date: ${new Date(date).toLocaleString()} - 
                      Return Date: ${new Date(returnDate).toLocaleString()}
                      `,
                    ],
                  },
                ],
              ],
            },
          },
        ];

        const response = {
          fulfillmentMessages: availableTrips,
        };

        resolve(response);
      } else {
        const response = {
          fulfillmentText: `Sorry, there are no return trips available from ${pickupLocationByUser} to ${dropLocationByUser}.`,
        };
        resolve(response);
      }
    } catch (error) {
      console.error("ERROR IN GETRETURNTRIPS", error);
      const response = {
        fulfillmentMessages: defaultFallbackResponse,
      };
      reject(response);
    }
  });
};

const getTourPackages = async (response) => {
  return new Promise((resolve, reject) => {
    let countryName;
    const outputContext = response?.outputContexts?.[0];

    switch (typeof outputContext?.parameters?.country_name) {
      case "string":
        countryName = outputContext?.parameters?.country_name?.toLowerCase();
        break;
      case "object":
        outputContext?.parameters?.country_name?.country?.toLowerCase();
        break;
    }

    if (!countryName) {
      const response = {
        fulfillmentText:
          "I apologize, but I couldn't understand your request. Could you please rephrase or provide more details?",
      };
      resolve(response);
    }

    try {
      db.query(
        `
      SELECT tour_name, start_date, end_date, thumbnail 
      FROM tour 
      LEFT JOIN country ON country.id = tour.country_id
      WHERE tour.status = 'active' 
      AND tour.start_date >= CURDATE()
      AND tour.deleted_at IS NULL
      AND LOWER(country.name) = '${countryName}'
      `,

        (error, results) => {
          if (error) {
            console.error("ERROR IN GETTOURPACKAGES:", error);
            const response = {
              fulfillmentMessages: defaultFallbackResponse,
            };
            reject(response);
          }

          if (results?.length > 0) {
            const tours = [];
            results.map((tour) => {
              tours.push({
                type: "info",
                title: tour?.tour_name,
                subtitle: `${tour?.start_date} - ${tour?.end_date}`,
                image: {
                  src: {
                    rawUrl: tour?.thumbnail,
                  },
                },
                actionLink: "https://transtar.softrefine.com/tours",
              });
            });

            const tourPackages = [
              {
                payload: {
                  richContent: [tours],
                },
              },
            ];

            const response = {
              fulfillmentMessages: tourPackages,
            };

            resolve(response);
          } else {
            const response = {
              fulfillmentText: `Sorry, there are no tours available for ${countryName}.`,
            };
            resolve(response);
          }
        }
      );
    } catch (error) {
      console.error("ERROR IN GETTOURPACKAGES", error);
      const response = {
        fulfillmentMessages: defaultFallbackResponse,
      };
      reject(response);
    }
  });
};

const getAttractionPackages = async (response) => {
  return new Promise((resolve, reject) => {
    let countryName;
    const outputContext = response?.outputContexts?.[0];

    switch (typeof outputContext?.parameters?.country_name) {
      case "string":
        countryName = outputContext?.parameters?.country_name?.toLowerCase();
        break;
      case "object":
        outputContext?.parameters?.country_name?.country?.toLowerCase();
        break;
    }

    if (!countryName) {
      const response = {
        fulfillmentText:
          "I apologize, but I couldn't understand your request. Could you please rephrase or provide more details?",
      };
      resolve(response);
    }

    try {
      db.query(
        `
        SELECT attraction_name, start_date, thumbnail
        FROM attractions 
        LEFT JOIN country ON country.id = attractions.country_id
        WHERE attractions.status = 'active' 
        AND attractions.start_date >= CURDATE()
        AND attractions.deleted_at IS NULL
        AND LOWER(country.name) = '${countryName?.toLowerCase()}'
        `,

        (error, results) => {
          if (error) {
            console.error("ERROR IN GETATTRACTIONPACKAGES", error);
            const response = {
              fulfillmentMessages: defaultFallbackResponse,
            };
            reject(response);
          }

          if (results?.length > 0) {
            const attractions = [];
            results.map((attraction) => {
              attractions.push({
                type: "list",
                title: attraction?.attraction_name,
                subtitle: `${attraction?.start_date}`,

                type: "info",
                title: attraction?.attraction_name,
                subtitle: `${attraction?.start_date}`,
                image: {
                  src: {
                    rawUrl: attraction?.thumbnail,
                  },
                },
                actionLink: "https://transtar.softrefine.com/attractions",
              });
            });

            const attractionPackages = [
              {
                payload: {
                  richContent: [attractions],
                },
              },
            ];

            const response = {
              fulfillmentMessages: attractionPackages,
            };

            resolve(response);
          } else {
            const response = {
              fulfillmentText: `Sorry, there are no attraction packages available for ${countryName}.`,
            };
            resolve(response);
          }
        }
      );
    } catch (error) {
      console.error("ERROR IN GETATTRACTIONPACKAGES", error);
      const response = {
        fulfillmentMessages: defaultFallbackResponse,
      };
      reject(response);
    }
  });
};

const trackTripTicket = async (response) => {
  return new Promise((resolve, reject) => {
    try {
      const ticketId = response?.parameters?.ticket_id;

      db.query(
        `
        SELECT paidamount, seatnumber, user_details.first_name, user_details.last_name, pickup_location.name AS pickup_name, drop_location.name AS drop_name
        FROM tickets 
        LEFT JOIN users ON users.id = tickets.passanger_id 
        LEFT JOIN user_details ON user_details.user_id = users.id
        LEFT JOIN locations AS pickup_location ON pickup_location.id = tickets.pick_location_id 
        LEFT JOIN locations AS drop_location ON drop_location.id = tickets.drop_location_id
        WHERE booking_id = '${ticketId}'
        AND tickets.deleted_at IS NULL
      `,
        (error, result) => {
          if (error) {
            console.error("ERROR IN TRACKTRIPTICKETS", error);
            const response = {
              fulfillmentMessages: defaultFallbackResponse,
            };
            reject(response);
          }

          if (result?.length > 0) {
            const passenger = result?.[0];
            const ticketInfo = [
              {
                payload: {
                  richContent: [
                    [
                      {
                        type: "description",
                        title: "Here are the details of your ticket.",
                        text: [
                          `Passenger Name: ${passenger?.first_name} ${passenger?.last_name}`,
                          `Seats: ${passenger?.seatnumber}`,
                          `Paid Amount: ${passenger?.paidamount}`,
                          `Pickup Location: ${passenger?.pickup_name}`,
                          `Drop Location: ${passenger?.drop_name}`,
                        ],
                      },
                    ],
                  ],
                },
              },
            ];
            const response = {
              fulfillmentMessages: ticketInfo,
            };
            resolve(response);
          } else {
            const response = {
              fulfillmentText: `Sorry, there are no tickets found for ${ticketId}.`,
            };
            resolve(response);
          }
        }
      );
    } catch (error) {
      console.error("ERROR IN TRACKTRIPTICKETS", error);
      const response = {
        fulfillmentMessages: defaultFallbackResponse,
      };
      reject(response);
    }
  });
};

const trackTourTicket = async (response) => {
  return new Promise((resolve, reject) => {
    try {
      const ticketId = response?.parameters?.ticket_id;

      db.query(
        `
        SELECT paid_amount, adult_seats, child_seats, special_seats, tourtickets.status, user_details.first_name, user_details.last_name, pickup_location.name AS pickup_name, drop_location.name AS drop_name 
        FROM tourtickets 
        LEFT JOIN users ON users.id = tourtickets.passanger_id 
        LEFT JOIN user_details ON user_details.user_id = users.id
        LEFT JOIN locations AS pickup_location ON pickup_location.id = tourtickets.pick_location_id 
        LEFT JOIN locations AS drop_location ON drop_location.id = tourtickets.drop_location_id
        WHERE booking_id = '${ticketId}'
        AND tourtickets.deleted_at IS NULL
      `,
        (error, result) => {
          if (error) {
            console.error("Error querying the tour ticket:", error);
            const response = {
              fulfillmentMessages: defaultFallbackResponse,
            };
            reject(response);
          }

          if (result?.length > 0) {
            const passenger = result?.[0];
            const ticketInfo = [
              {
                payload: {
                  richContent: [
                    [
                      {
                        type: "description",
                        title: "Here are the details of your ticket.",
                        text: [
                          `Passenger Name: ${passenger?.first_name} ${passenger?.last_name}`,
                          `Paid Amount: ${passenger?.paid_amount}`,
                          `Adult Seats: ${passenger?.adult_seats}`,
                          `Child Seats: ${passenger?.child_seats}`,
                          `Special Seats: ${passenger?.special_seats}`,
                          `Pickup Location: ${passenger?.pickup_name}`,
                          `Drop Location: ${passenger?.drop_name}`,
                          `Ticket Status: ${passenger?.status}`,
                        ],
                      },
                    ],
                  ],
                },
              },
            ];
            const response = {
              fulfillmentMessages: ticketInfo,
            };
            resolve(response);
          } else {
            const response = {
              fulfillmentText: `Sorry, there are no tickets found for ${ticketId}.`,
            };
            resolve(response);
          }
        }
      );
    } catch (error) {
      console.error("ERROR IN TRACKTOURTICKETS", error);
      const response = {
        fulfillmentMessages: defaultFallbackResponse,
      };
      reject(response);
    }
  });
};

const trackAttractionTicket = async (response) => {
  return new Promise((resolve, reject) => {
    try {
      const ticketId = response?.parameters?.ticket_id;
      db.query(
        `
        SELECT paidamount, adult, child, misc, attractiontickets.status, user_details.first_name, user_details.last_name, attractions.attraction_name, attractions.adult_price, attractions.child_price, attractions.misc_price
        FROM attractiontickets 
        LEFT JOIN users ON users.id = attractiontickets.passanger_id 
        LEFT JOIN user_details ON user_details.user_id = users.id
        LEFT JOIN attractions ON attractions.id = attractiontickets.attraction_id
        WHERE booking_id = '${ticketId}'
        AND attractiontickets.deleted_at IS NULL
      `,
        (error, result) => {
          if (error) {
            console.error("ERROR IN TRACKATTRACTIONTICKETS", error);
            const response = {
              fulfillmentMessages: defaultFallbackResponse,
            };
            reject(response);
          }

          if (result?.length > 0) {
            const passenger = result?.[0];
            const ticketInfo = [
              {
                payload: {
                  richContent: [
                    [
                      {
                        type: "description",
                        title: "Here are the details of your ticket.",
                        text: [
                          `Attraction Name: ${passenger?.attraction_name}`,
                          `Adult Price: ${passenger?.adult_price}`,
                          `Child Price: ${passenger?.child_price}`,
                          `Misc Price: ${passenger?.misc_price}`,
                          `Passenger Name: ${passenger?.first_name} ${passenger?.last_name}`,
                          `Adult Seats: ${passenger?.adult}`,
                          `Child Seats: ${passenger?.child}`,
                          `Misc Seats: ${passenger?.misc}`,
                          `Paid Amount: ${passenger?.paidamount}`,
                          `Ticket Status: ${passenger?.status}`,
                        ],
                      },
                    ],
                  ],
                },
              },
            ];
            const response = {
              fulfillmentMessages: ticketInfo,
            };
            resolve(response);
          } else {
            const response = {
              fulfillmentText: `Sorry, there are no tickets found for ${ticketId}.`,
            };
            resolve(response);
          }
        }
      );
    } catch (error) {
      console.error("ERROR IN TRACKTRIPTICKETS", error);
      const response = {
        fulfillmentMessages: defaultFallbackResponse,
      };
      reject(response);
    }
  });
};

const fallbackResponse = async (response) => {
  return new Promise(async (resolve, reject) => {
    try {
      const queryText = response?.queryText;
      const openAIResponsePromise = await openai.completions.create({
        model: "text-davinci-003",
        prompt: queryText,
        max_tokens: 50,
        temperature: 0.1,
      });
      const openAIResponse = openAIResponsePromise.choices[0].text;
      const res = {
        fulfillmentText: openAIResponse,
      };
      resolve(res);
    } catch (error) {
      console.error("ERROR IN FALLBACKRESPONSE", error);
      const res = {
        fulfillmentMessages: defaultFallbackResponse,
      };
      reject(res);
    }
  });
};

const actionFunctions = {
  "get.onewaytripsdata": getOneWayTrips,
  "get.returntripsdata": getReturnTrips,
  "search.tours": getTourPackages,
  "search.attractions": getAttractionPackages,
  "track.tripticket-custom": trackTripTicket,
  "track.tourticket-custom": trackTourTicket,
  "track.attractionticket-custom": trackAttractionTicket,
  "input.unknown": fallbackResponse,
};

app.post("/dialogflow", async (req, res) => {
  try {
    const queryResult = req.body.queryResult;
    const action = queryResult?.action;
    const actionFunction = actionFunctions?.[action];

    if (!actionFunction) {
      throw new Error({
        fulfillmentMessages: defaultFallbackResponse,
      });
    }

    const timeout = new Promise((_, reject) => {
      setTimeout(() => {
        reject({
          fulfillmentMessages: defaultFallbackResponse,
        });
      }, 10000);
    });

    const data = actionFunction(queryResult);
    const result = await Promise.race([data, timeout]);
    res.json(result);
  } catch (error) {
    console.error("ERROR IN CATCHBLOCK", error);
    res.json(error);
  }
});
